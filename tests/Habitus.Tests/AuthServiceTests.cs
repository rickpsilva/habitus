using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Auth;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Moq;

namespace Habitus.Tests;

public class AuthServiceTests
{
    private readonly Mock<IRepository<User>> _userRepositoryMock;
    private readonly Mock<IRepository<UserCondominium>> _userCondominiumRepositoryMock;
    private readonly Mock<IRepository<Condominium>> _condominiumRepositoryMock;
    private readonly Mock<IRepository<Unit>> _unitRepositoryMock;
    private readonly Mock<IRepository<UserAuthProvider>> _userAuthProviderRepositoryMock;
    private readonly Mock<IRepository<UserRecoveryCode>> _userRecoveryCodeRepositoryMock;
    private readonly Mock<IRepository<AuthChallenge>> _authChallengeRepositoryMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<IEncryptionService> _encryptionServiceMock;
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        _userRepositoryMock = new Mock<IRepository<User>>();
        _userCondominiumRepositoryMock = new Mock<IRepository<UserCondominium>>();
        _condominiumRepositoryMock = new Mock<IRepository<Condominium>>();
        _unitRepositoryMock = new Mock<IRepository<Unit>>();
        _userAuthProviderRepositoryMock = new Mock<IRepository<UserAuthProvider>>();
        _userRecoveryCodeRepositoryMock = new Mock<IRepository<UserRecoveryCode>>();
        _authChallengeRepositoryMock = new Mock<IRepository<AuthChallenge>>();
        _emailServiceMock = new Mock<IEmailService>();
        _encryptionServiceMock = new Mock<IEncryptionService>();

        _userRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userCondominiumRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userAuthProviderRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userRecoveryCodeRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _authChallengeRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        _service = new AuthService(
            _userRepositoryMock.Object,
            _userCondominiumRepositoryMock.Object,
            _condominiumRepositoryMock.Object,
            _unitRepositoryMock.Object,
            _userAuthProviderRepositoryMock.Object,
            _userRecoveryCodeRepositoryMock.Object,
            _authChallengeRepositoryMock.Object,
            BuildConfiguration(),
            _emailServiceMock.Object,
            _encryptionServiceMock.Object);
    }

    [Fact]
    public async Task LoginAsync_ShouldLockUserAfterFifthFailedAttempt()
    {
        var user = BuildUser();
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword("right-password");
        user.FailedLoginCount = 4;

        _userRepositoryMock
            .Setup(r => r.FindWithIncludesAsync(It.IsAny<Expression<Func<User, bool>>>(), It.IsAny<string[]>()))
            .ReturnsAsync([user]);

        var result = await _service.LoginAsync(new LoginRequest
        {
            Email = user.Email,
            Password = "wrong-password"
        });

        result.Should().BeNull();
        user.FailedLoginCount.Should().Be(0);
        user.LockoutUntil.Should().NotBeNull();
        user.LockoutUntil.Should().BeAfter(DateTime.UtcNow.AddMinutes(14));

        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _userRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task LoginAsync_WithTwoFactorEnabled_ShouldReturnChallengeResponse()
    {
        var condominiumId = Guid.NewGuid();
        var user = BuildUser();
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword("right-password");
        user.TwoFactorEnabled = true;
        user.UserCondominiums.Add(new UserCondominium
        {
            UserId = user.Id,
            CondominiumId = condominiumId,
            GrantedAt = DateTime.UtcNow,
            CanManage = true,
        });

        var challenges = new List<AuthChallenge>();
        AuthChallenge? createdChallenge = null;

        _userRepositoryMock
            .Setup(r => r.FindWithIncludesAsync(It.IsAny<Expression<Func<User, bool>>>(), It.IsAny<string[]>()))
            .ReturnsAsync([user]);

        _authChallengeRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<AuthChallenge, bool>>>()))
            .ReturnsAsync((Expression<Func<AuthChallenge, bool>> predicate) => challenges.Where(predicate.Compile()).ToList());

        _authChallengeRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<AuthChallenge>()))
            .Callback<AuthChallenge>(challenge =>
            {
                createdChallenge = challenge;
                challenges.Add(challenge);
            })
            .Returns(Task.CompletedTask);

        var result = await _service.LoginAsync(
            new LoginRequest { Email = user.Email, Password = "right-password" },
            "127.0.0.1",
            "unit-test");

        result.Should().NotBeNull();
        result!.RequiresTwoFactor.Should().BeTrue();
        result.Token.Should().BeNullOrEmpty();
        result.ChallengeId.Should().NotBeNullOrWhiteSpace();
        result.AvailableTwoFactorMethods.Should().Contain(["totp", "recovery_code"]);
        result.AccessibleCondominiums.Should().ContainSingle().Which.Should().Be(condominiumId);

        createdChallenge.Should().NotBeNull();
        createdChallenge!.UserId.Should().Be(user.Id);
        createdChallenge.IpAddress.Should().Be("127.0.0.1");
        createdChallenge.UserAgent.Should().Be("unit-test");

        _authChallengeRepositoryMock.Verify(r => r.AddAsync(It.IsAny<AuthChallenge>()), Times.Once);
    }

    [Fact]
    public async Task CompleteTwoFactorLoginAsync_WithRecoveryCode_ShouldAuthenticateAndConsumeCode()
    {
        var recoveryCodePlain = "ABCDE-12345";
        var user = BuildUser();
        user.TwoFactorEnabled = true;
        user.UserCondominiums.Add(new UserCondominium
        {
            UserId = user.Id,
            CondominiumId = Guid.NewGuid(),
            GrantedAt = DateTime.UtcNow,
            CanManage = false,
        });

        var challengeId = Guid.NewGuid();
        var challenge = new AuthChallenge
        {
            Id = challengeId,
            UserId = user.Id,
            User = user,
            Purpose = AuthChallengePurpose.TwoFactorLogin,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
        };

        var recoveryCodes = new List<UserRecoveryCode>
        {
            new()
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                CodeHash = BCrypt.Net.BCrypt.HashPassword(recoveryCodePlain),
                CreatedAt = DateTime.UtcNow,
            }
        };

        _authChallengeRepositoryMock
            .Setup(r => r.GetByIdWithIncludesAsync(challengeId, It.IsAny<string[]>()))
            .ReturnsAsync(challenge);

        _userRecoveryCodeRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserRecoveryCode, bool>>>()))
            .ReturnsAsync((Expression<Func<UserRecoveryCode, bool>> predicate) => recoveryCodes.Where(predicate.Compile()).ToList());

        var result = await _service.CompleteTwoFactorLoginAsync(
            new CompleteTwoFactorLoginRequest
            {
                ChallengeId = challengeId.ToString(),
                Code = recoveryCodePlain,
                UseRecoveryCode = true,
            },
            "10.0.0.1",
            "integration-test-agent");

        result.Should().NotBeNull();
        result!.RequiresTwoFactor.Should().BeFalse();
        result.Token.Should().NotBeNullOrWhiteSpace();

        challenge.UsedAt.Should().NotBeNull();
        challenge.IpAddress.Should().Be("10.0.0.1");
        challenge.UserAgent.Should().Be("integration-test-agent");
        recoveryCodes.Single().UsedAt.Should().NotBeNull();

        _userRecoveryCodeRepositoryMock.Verify(r => r.Update(It.IsAny<UserRecoveryCode>()), Times.Once);
        _authChallengeRepositoryMock.Verify(r => r.Update(challenge), Times.Once);
    }

    [Fact]
    public async Task LinkExternalProviderAsync_WhenProviderBelongsToAnotherUser_ShouldReturnFalse()
    {
        var user = BuildUser();
        var otherUserId = Guid.NewGuid();
        var existingLinks = new List<UserAuthProvider>
        {
            new()
            {
                Id = Guid.NewGuid(),
                UserId = otherUserId,
                ProviderType = ExternalAuthProvider.Google,
                ProviderUserId = "google-123",
                ProviderEmail = "other-user@example.com",
                CreatedAt = DateTime.UtcNow,
            }
        };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _userAuthProviderRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserAuthProvider, bool>>>()))
            .ReturnsAsync((Expression<Func<UserAuthProvider, bool>> predicate) => existingLinks.Where(predicate.Compile()).ToList());

        var result = await _service.LinkExternalProviderAsync(
            user.Id,
            ExternalAuthProvider.Google,
            "google-123",
            "user@example.com");

        result.Should().BeFalse();
        _userAuthProviderRepositoryMock.Verify(r => r.AddAsync(It.IsAny<UserAuthProvider>()), Times.Never);
        _userAuthProviderRepositoryMock.Verify(r => r.Update(It.IsAny<UserAuthProvider>()), Times.Never);
    }

    [Fact]
    public async Task GetTwoFactorSecurityAsync_ShouldReturnOrderedProvidersAndRemainingCodes()
    {
        var user = BuildUser();
        user.TwoFactorEnabled = true;

        var recoveryCodes = new List<UserRecoveryCode>
        {
            new() { Id = Guid.NewGuid(), UserId = user.Id, CodeHash = "hash-1", CreatedAt = DateTime.UtcNow, UsedAt = null },
            new() { Id = Guid.NewGuid(), UserId = user.Id, CodeHash = "hash-2", CreatedAt = DateTime.UtcNow, UsedAt = null },
            new() { Id = Guid.NewGuid(), UserId = user.Id, CodeHash = "hash-3", CreatedAt = DateTime.UtcNow, UsedAt = DateTime.UtcNow }
        };

        var providers = new List<UserAuthProvider>
        {
            new()
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                ProviderType = ExternalAuthProvider.Microsoft,
                ProviderUserId = "ms-1",
                ProviderEmail = "ms@example.com",
                CreatedAt = DateTime.UtcNow,
            },
            new()
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                ProviderType = ExternalAuthProvider.Google,
                ProviderUserId = "google-1",
                ProviderEmail = "google@example.com",
                CreatedAt = DateTime.UtcNow,
            }
        };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _userRecoveryCodeRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserRecoveryCode, bool>>>()))
            .ReturnsAsync((Expression<Func<UserRecoveryCode, bool>> predicate) => recoveryCodes.Where(predicate.Compile()).ToList());
        _userAuthProviderRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserAuthProvider, bool>>>()))
            .ReturnsAsync((Expression<Func<UserAuthProvider, bool>> predicate) => providers.Where(predicate.Compile()).ToList());

        var result = await _service.GetTwoFactorSecurityAsync(user.Id);

        result.Should().NotBeNull();
        result!.TwoFactorEnabled.Should().BeTrue();
        result.RecoveryCodesRemaining.Should().Be(2);
        result.LinkedProviders.Select(p => p.Provider).Should().ContainInOrder("Google", "Microsoft");
    }

    private static IConfiguration BuildConfiguration()
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = "unit-test-jwt-secret-key-1234567890",
                ["JwtSettings:ExpiryMinutes"] = "60",
                ["JwtSettings:Issuer"] = "habitus-tests",
                ["JwtSettings:Audience"] = "habitus-tests-audience",
                ["Frontend:BaseUrl"] = "http://localhost:5173"
            })
            .Build();
    }

    private static User BuildUser()
    {
        return new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User",
            Email = "test@example.com",
            Phone = "910000000",
            Role = UserRole.Manager,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("right-password"),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
    }
}
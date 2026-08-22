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
    private readonly Mock<IRepository<UnitMembership>> _unitMembershipRepositoryMock;
    private readonly Mock<IRepository<UserAuthProvider>> _userAuthProviderRepositoryMock;
    private readonly Mock<IRepository<UserRecoveryCode>> _userRecoveryCodeRepositoryMock;
    private readonly Mock<IRepository<AuthChallenge>> _authChallengeRepositoryMock;
    private readonly Mock<IRepository<ImpersonationSession>> _impersonationSessionRepositoryMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<IEncryptionService> _encryptionServiceMock;
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        _userRepositoryMock = new Mock<IRepository<User>>();
        _userCondominiumRepositoryMock = new Mock<IRepository<UserCondominium>>();
        _condominiumRepositoryMock = new Mock<IRepository<Condominium>>();
        _unitRepositoryMock = new Mock<IRepository<Unit>>();
        _unitMembershipRepositoryMock = new Mock<IRepository<UnitMembership>>();
        _userAuthProviderRepositoryMock = new Mock<IRepository<UserAuthProvider>>();
        _userRecoveryCodeRepositoryMock = new Mock<IRepository<UserRecoveryCode>>();
        _authChallengeRepositoryMock = new Mock<IRepository<AuthChallenge>>();
        _impersonationSessionRepositoryMock = new Mock<IRepository<ImpersonationSession>>();
        _emailServiceMock = new Mock<IEmailService>();
        _encryptionServiceMock = new Mock<IEncryptionService>();

        _encryptionServiceMock
            .Setup(e => e.Encrypt(It.IsAny<string>()))
            .Returns((string plaintext) => $"enc:{plaintext}");
        _encryptionServiceMock
            .Setup(e => e.Decrypt(It.IsAny<string>()))
            .Returns((string ciphertext) => ciphertext.StartsWith("enc:") ? ciphertext[4..] : ciphertext);

        _userRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userCondominiumRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userAuthProviderRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userRecoveryCodeRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _authChallengeRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _impersonationSessionRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        _unitMembershipRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UnitMembership, bool>>>()))
            .ReturnsAsync(new List<UnitMembership>());

        _service = new AuthService(
            _userRepositoryMock.Object,
            _userCondominiumRepositoryMock.Object,
            _condominiumRepositoryMock.Object,
            _unitRepositoryMock.Object,
            _unitMembershipRepositoryMock.Object,
            _userAuthProviderRepositoryMock.Object,
            _userRecoveryCodeRepositoryMock.Object,
            _authChallengeRepositoryMock.Object,
            _impersonationSessionRepositoryMock.Object,
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
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) => new[] { user }.FirstOrDefault(predicate.Compile()));

        var result = await _service.LoginAsync(new LoginRequest
        {
            Email = TestUserEmail,
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
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) => new[] { user }.FirstOrDefault(predicate.Compile()));

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
            new LoginRequest { Email = TestUserEmail, Password = "right-password" },
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
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<UserAuthProvider, bool>>>()))
            .ReturnsAsync((Expression<Func<UserAuthProvider, bool>> predicate) => existingLinks.FirstOrDefault(predicate.Compile()));

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

    [Fact]
    public async Task EnsureInitialManagerAsync_ShouldCreateManager_WhenNoneExistsAndConfigurationIsPresent()
    {
        User? createdUser = null;

        var service = BuildService(new Dictionary<string, string?>
        {
            ["InitialManager:Name"] = "Ricardo Silva",
            ["InitialManager:Email"] = "ricardopsilva@hotmail.com",
            ["InitialManager:Password"] = "StrongPassword!123",
            ["InitialManager:Phone"] = "+351910000000",
        });

        _userRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) => Array.Empty<User>().Where(predicate.Compile()).ToList());

        _userRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<User>()))
            .Callback<User>(user => createdUser = user)
            .Returns(Task.CompletedTask);

        var result = await service.EnsureInitialManagerAsync();

        result.Should().Be(InitialManagerBootstrapStatus.Created);
        createdUser.Should().NotBeNull();
        createdUser!.Role.Should().Be(UserRole.Manager);
        createdUser.EmailEncrypted.Should().Be("enc:ricardopsilva@hotmail.com");
        createdUser.EmailHash.Should().NotBeNullOrWhiteSpace();
        createdUser.PhoneEncrypted.Should().Be("enc:+351910000000");
        BCrypt.Net.BCrypt.Verify("StrongPassword!123", createdUser.PasswordHash).Should().BeTrue();

        _userRepositoryMock.Verify(r => r.AddAsync(It.IsAny<User>()), Times.Once);
        _userRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task EnsureInitialManagerAsync_ShouldSkip_WhenManagerAlreadyExists()
    {
        var existingManager = BuildUser();
        var service = BuildService(new Dictionary<string, string?>
        {
            ["InitialManager:Name"] = "Ricardo Silva",
            ["InitialManager:Email"] = "ricardopsilva@hotmail.com",
            ["InitialManager:Password"] = "StrongPassword!123",
        });

        _userRepositoryMock
            .Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) => new[] { existingManager }.Any(predicate.Compile()));

        var result = await service.EnsureInitialManagerAsync();

        result.Should().Be(InitialManagerBootstrapStatus.ManagerAlreadyExists);
        _userRepositoryMock.Verify(r => r.AddAsync(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_ShouldRejectPublicManagerRegistration()
    {
        _userRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync(Array.Empty<User>());

        var action = () => _service.RegisterAsync(new RegisterRequest
        {
            Name = "Manager",
            Email = "manager@example.com",
            Password = "StrongPassword!123",
            Phone = "910000000",
            Role = "Manager",
        });

        await action.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Manager accounts is not allowed*");
    }

    [Fact]
    public async Task RegisterAsync_WhenEmailAlreadyExists_ShouldThrowRegistrationConflictException()
    {
        _userRepositoryMock
            .Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync(true);

        var action = () => _service.RegisterAsync(new RegisterRequest
        {
            Name = "Existing",
            Email = "existing@example.com",
            Password = "StrongPassword!123",
            Phone = "910000000",
            Role = "Resident",
            CondominiumId = Guid.NewGuid(),
            UnitId = Guid.NewGuid(),
        });

        var ex = await action.Should().ThrowAsync<RegistrationConflictException>();
        ex.Which.Code.Should().Be("email_already_exists");
        ex.Which.NextAction.Should().Be("sign_in_and_request_association");
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

    private AuthService BuildService(IDictionary<string, string?> settings)
    {
        return new AuthService(
            _userRepositoryMock.Object,
            _userCondominiumRepositoryMock.Object,
            _condominiumRepositoryMock.Object,
            _unitRepositoryMock.Object,
            _unitMembershipRepositoryMock.Object,
            _userAuthProviderRepositoryMock.Object,
            _userRecoveryCodeRepositoryMock.Object,
            _authChallengeRepositoryMock.Object,
            _impersonationSessionRepositoryMock.Object,
            new ConfigurationBuilder().AddInMemoryCollection(settings).Build(),
            _emailServiceMock.Object,
            _encryptionServiceMock.Object);
    }

    [Fact]
    public async Task SetActiveContextAsync_ForMembershipNotHeld_Throws()
    {
        var user = BuildUser();
        user.Role = UserRole.Resident;
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();

        _userRepositoryMock.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);
        // No membership exists for this unit/condominium -> ExistsAsync returns false (Moq default).

        var act = () => _service.SetActiveContextAsync(user.Id, condominiumId, unitId);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task SetActiveContextAsync_ForHeldMembership_ReturnsTokenWithContext()
    {
        var user = BuildUser();
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        user.UserCondominiums.Add(new UserCondominium
        {
            UserId = user.Id,
            CondominiumId = condominiumId,
            GrantedAt = DateTime.UtcNow,
            CanManage = true,
        });

        _userRepositoryMock.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _unitMembershipRepositoryMock
            .Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<UnitMembership, bool>>>()))
            .ReturnsAsync(true);

        var result = await _service.SetActiveContextAsync(user.Id, condominiumId, unitId);

        result.Should().NotBeNull();
        result!.CondominiumId.Should().Be(condominiumId);
        result.UnitId.Should().Be(unitId);
        result.Token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task LoginAsync_RequiresContextSelection_TrueOnlyWithMoreThanOneMembership()
    {
        var condominiumId = Guid.NewGuid();

        var user = BuildUser();
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword("right-password");
        user.UserCondominiums.Add(new UserCondominium
        {
            UserId = user.Id,
            CondominiumId = condominiumId,
            GrantedAt = DateTime.UtcNow,
            CanManage = true,
        });

        _userRepositoryMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) => new[] { user }.FirstOrDefault(predicate.Compile()));

        // Single membership -> selection not required.
        _unitMembershipRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UnitMembership, bool>>>()))
            .ReturnsAsync(new List<UnitMembership> { new() { Id = Guid.NewGuid(), UserId = user.Id, CondominiumId = condominiumId, UnitId = Guid.NewGuid(), IsPrimary = true } });

        var single = await _service.LoginAsync(new LoginRequest { Email = TestUserEmail, Password = "right-password" });
        single.Should().NotBeNull();
        single!.RequiresContextSelection.Should().BeFalse();

        // Two memberships -> selection required.
        _unitMembershipRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UnitMembership, bool>>>()))
            .ReturnsAsync(new List<UnitMembership>
            {
                new() { Id = Guid.NewGuid(), UserId = user.Id, CondominiumId = condominiumId, UnitId = Guid.NewGuid(), IsPrimary = true },
                new() { Id = Guid.NewGuid(), UserId = user.Id, CondominiumId = Guid.NewGuid(), UnitId = Guid.NewGuid(), IsPrimary = true },
            });

        var multi = await _service.LoginAsync(new LoginRequest { Email = TestUserEmail, Password = "right-password" });
        multi.Should().NotBeNull();
        multi!.RequiresContextSelection.Should().BeTrue();
    }

    private const string TestUserEmail = "test@example.com";

    [Fact]
    public async Task RepairMissingEmailHashesAsync_ShouldRecomputeHash_WhenEmailEncryptedIsPresentAndHashIsMissing()
    {
        var user = BuildUser();
        user.EmailHash = null;
        user.EmailEncrypted = "enc:repair@example.com";

        _userRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync(new List<User> { user });

        var repaired = await _service.RepairMissingEmailHashesAsync();

        repaired.Should().Be(1);
        user.EmailHash.Should().Be(Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash("repair@example.com"));
        _userRepositoryMock.Verify(r => r.Update(It.Is<User>(u => u.Id == user.Id)), Times.Once);
        _userRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task RepairMissingEmailHashesAsync_ShouldSkip_WhenNoUserNeedsRepair()
    {
        _userRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync(new List<User>());

        var repaired = await _service.RepairMissingEmailHashesAsync();

        repaired.Should().Be(0);
        _userRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Never);
    }

    [Fact]
    public async Task RepairMissingEmailHashesAsync_WithEmail_ShouldRepairOnlyMatchingUser()
    {
        var user = BuildUser();
        user.EmailHash = null;
        user.EmailEncrypted = "enc:specific@example.com";

        _userRepositoryMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) => new[] { user }.FirstOrDefault(predicate.Compile()));

        var repaired = await _service.RepairMissingEmailHashesAsync("specific@example.com");

        repaired.Should().Be(1);
        user.EmailHash.Should().Be(Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash("specific@example.com"));
        _userRepositoryMock.Verify(r => r.Update(It.Is<User>(u => u.Id == user.Id)), Times.Once);
        _userRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task StartImpersonationAsync_WithValidAdminTarget_ReturnsToken()
    {
        var condominiumId = Guid.NewGuid();
        var manager = BuildUser();
        manager.Role = UserRole.Manager;
        var admin = BuildUser();
        admin.Role = UserRole.Admin;
        admin.CondominiumId = condominiumId;
        var condominium = new Condominium { Id = condominiumId, Name = "Cond A", IsActive = true };

        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(manager.Id)).ReturnsAsync(manager);
        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(admin.Id)).ReturnsAsync(admin);
        _userCondominiumRepositoryMock
            .Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>()))
            .ReturnsAsync(true);
        _condominiumRepositoryMock.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(condominium);
        _impersonationSessionRepositoryMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ImpersonationSession, bool>>>()))
            .ReturnsAsync((ImpersonationSession?)null);

        var result = await _service.StartImpersonationAsync(manager.Id, new StartImpersonationRequest
        {
            TargetUserId = admin.Id,
        });

        result.Should().NotBeNull();
        result!.ImpersonatedUserId.Should().Be(admin.Id);
        result.ImpersonatedRole.Should().Be((int)UserRole.Admin);
        result.CondominiumId.Should().Be(condominiumId);
        result.Token.Should().NotBeNullOrWhiteSpace();
        _impersonationSessionRepositoryMock.Verify(r => r.AddAsync(It.Is<ImpersonationSession>(s =>
            s.ImpersonatorUserId == manager.Id && s.ImpersonatedUserId == admin.Id)), Times.Once);
        _impersonationSessionRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task StartImpersonationAsync_WithInactiveManager_ReturnsNull()
    {
        var manager = BuildUser();
        manager.Role = UserRole.Manager;
        manager.IsActive = false;
        var target = BuildUser();
        target.Role = UserRole.Admin;

        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(manager.Id)).ReturnsAsync(manager);
        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(target.Id)).ReturnsAsync(target);

        var result = await _service.StartImpersonationAsync(manager.Id, new StartImpersonationRequest
        {
            TargetUserId = target.Id,
        });

        result.Should().BeNull();
    }

    [Fact]
    public async Task StartImpersonationAsync_WithManagerTarget_ReturnsNull()
    {
        var manager = BuildUser();
        manager.Role = UserRole.Manager;
        var target = BuildUser();
        target.Role = UserRole.Manager;

        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(manager.Id)).ReturnsAsync(manager);
        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(target.Id)).ReturnsAsync(target);

        var result = await _service.StartImpersonationAsync(manager.Id, new StartImpersonationRequest
        {
            TargetUserId = target.Id,
        });

        result.Should().BeNull();
    }

    [Fact]
    public async Task StartImpersonationAsync_WithTargetWithoutCondominium_ReturnsNull()
    {
        var manager = BuildUser();
        manager.Role = UserRole.Manager;
        var target = BuildUser();
        target.Role = UserRole.Admin;
        target.CondominiumId = null;

        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(manager.Id)).ReturnsAsync(manager);
        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(target.Id)).ReturnsAsync(target);

        var result = await _service.StartImpersonationAsync(manager.Id, new StartImpersonationRequest
        {
            TargetUserId = target.Id,
        });

        result.Should().BeNull();
    }

    [Fact]
    public async Task StartImpersonationAsync_WithManagerWithoutAccess_ReturnsNull()
    {
        var condominiumId = Guid.NewGuid();
        var manager = BuildUser();
        manager.Role = UserRole.Manager;
        var target = BuildUser();
        target.Role = UserRole.Admin;
        target.CondominiumId = condominiumId;

        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(manager.Id)).ReturnsAsync(manager);
        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(target.Id)).ReturnsAsync(target);
        // Manager has UserCondominium entries but not for the target condominium
        _userCondominiumRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>()))
            .ReturnsAsync(new List<UserCondominium> { new UserCondominium { UserId = manager.Id, CondominiumId = Guid.NewGuid(), CanManage = true } });

        var result = await _service.StartImpersonationAsync(manager.Id, new StartImpersonationRequest
        {
            TargetUserId = target.Id,
        });

        result.Should().BeNull();
    }

    [Fact]
    public async Task StartImpersonationAsync_WithPlatformLevelManager_ReturnsToken()
    {
        var condominiumId = Guid.NewGuid();
        var manager = BuildUser();
        manager.Role = UserRole.Manager;
        var target = BuildUser();
        target.Role = UserRole.Admin;
        target.CondominiumId = condominiumId;
        var condominium = new Condominium { Id = condominiumId, Name = "Cond A", IsActive = true };

        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(manager.Id)).ReturnsAsync(manager);
        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(target.Id)).ReturnsAsync(target);
        // Platform-level manager: no UserCondominium entries
        _userCondominiumRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>()))
            .ReturnsAsync(new List<UserCondominium>());
        _condominiumRepositoryMock.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(condominium);
        _impersonationSessionRepositoryMock.Setup(r => r.AddAsync(It.IsAny<ImpersonationSession>())).Returns(Task.CompletedTask);
        _impersonationSessionRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _unitRepositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((Unit?)null);

        var result = await _service.StartImpersonationAsync(manager.Id, new StartImpersonationRequest
        {
            TargetUserId = target.Id,
        });

        result.Should().NotBeNull();
        result!.Token.Should().NotBeNullOrEmpty();
        result.ImpersonatedUserId.Should().Be(target.Id);
        _impersonationSessionRepositoryMock.Verify(r => r.AddAsync(It.Is<ImpersonationSession>(s =>
            s.ImpersonatorUserId == manager.Id &&
            s.ImpersonatedUserId == target.Id &&
            s.CondominiumId == condominiumId)), Times.Once);
    }

    [Fact]
    public async Task StartImpersonationAsync_WithUnknownUnitMembership_FallsBackToCondominiumLevel()
    {
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var manager = BuildUser();
        manager.Role = UserRole.Manager;
        var resident = BuildUser();
        resident.Role = UserRole.Resident;
        resident.CondominiumId = condominiumId;
        var condominium = new Condominium { Id = condominiumId, Name = "Cond A", IsActive = true };

        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(manager.Id)).ReturnsAsync(manager);
        _userRepositoryMock.Setup(r => r.GetByIdNoTrackingAsync(resident.Id)).ReturnsAsync(resident);
        _userCondominiumRepositoryMock
            .Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>()))
            .ReturnsAsync(true);
        _unitMembershipRepositoryMock
            .Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<UnitMembership, bool>>>()))
            .ReturnsAsync(false);
        _condominiumRepositoryMock.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(condominium);
        _impersonationSessionRepositoryMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ImpersonationSession, bool>>>()))
            .ReturnsAsync((ImpersonationSession?)null);

        var result = await _service.StartImpersonationAsync(manager.Id, new StartImpersonationRequest
        {
            TargetUserId = resident.Id,
            UnitId = unitId,
        });

        result.Should().NotBeNull();
        result!.UnitId.Should().BeNull();
    }

    [Fact]
    public async Task GetImpersonationStatusAsync_WithActiveSession_ReturnsCondominiumAndUnitDetails()
    {
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var manager = BuildUser();
        manager.Role = UserRole.Manager;
        var target = BuildUser();
        target.Role = UserRole.Resident;
        var condominium = new Condominium { Id = condominiumId, Name = "Cond A", IsActive = true };
        var unit = new Unit { Id = unitId, Number = "12A", CondominiumId = condominiumId };
        var session = new ImpersonationSession
        {
            ImpersonatorUserId = manager.Id,
            ImpersonatedUserId = target.Id,
            CondominiumId = condominiumId,
            UnitId = unitId,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            IsActive = true,
        };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(manager.Id)).ReturnsAsync(manager);
        _impersonationSessionRepositoryMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ImpersonationSession, bool>>>()))
            .ReturnsAsync(session);
        _userRepositoryMock.Setup(r => r.GetByIdAsync(target.Id)).ReturnsAsync(target);
        _condominiumRepositoryMock.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(condominium);
        _unitRepositoryMock.Setup(r => r.GetByIdAsync(unitId)).ReturnsAsync(unit);

        var result = await _service.GetImpersonationStatusAsync(manager.Id);

        result.Should().NotBeNull();
        result!.IsImpersonating.Should().BeTrue();
        result.ImpersonatedUserId.Should().Be(target.Id);
        result.CondominiumId.Should().Be(condominiumId);
        result.CondominiumName.Should().Be("Cond A");
        result.UnitId.Should().Be(unitId);
        result.UnitIdentifier.Should().Be("12A");
    }

    [Fact]
    public async Task GetImpersonationStatusAsync_WithExpiredSession_DeactivatesSessionAndReturnsNotImpersonating()
    {
        var manager = BuildUser();
        manager.Role = UserRole.Manager;
        var session = new ImpersonationSession
        {
            ImpersonatorUserId = manager.Id,
            ImpersonatedUserId = Guid.NewGuid(),
            CondominiumId = Guid.NewGuid(),
            ExpiresAt = DateTime.UtcNow.AddHours(-1),
            IsActive = true,
        };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(manager.Id)).ReturnsAsync(manager);
        _impersonationSessionRepositoryMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ImpersonationSession, bool>>>()))
            .ReturnsAsync(session);

        var result = await _service.GetImpersonationStatusAsync(manager.Id);

        result.Should().NotBeNull();
        result!.IsImpersonating.Should().BeFalse();
        session.IsActive.Should().BeFalse();
        session.EndReason.Should().Be("Expired");
        _impersonationSessionRepositoryMock.Verify(r => r.Update(session), Times.Once);
        _impersonationSessionRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    private static User BuildUser()
    {
        return new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User",
            EmailEncrypted = "enc:test@example.com",
            EmailHash = Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash(TestUserEmail),
            PhoneEncrypted = "enc:910000000",
            Role = UserRole.Manager,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("right-password"),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
    }
}
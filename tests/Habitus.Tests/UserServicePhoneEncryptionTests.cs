using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Users;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class UserServicePhoneEncryptionTests
{
    private readonly Mock<IRepository<User>> _userRepositoryMock;
    private readonly Mock<IRepository<UserCondominium>> _userCondominiumRepositoryMock;
    private readonly Mock<IRepository<Condominium>> _condominiumRepositoryMock;
    private readonly Mock<IRepository<Unit>> _unitRepositoryMock;
    private readonly Mock<IEncryptionService> _encryptionServiceMock;
    private readonly UserService _service;

    public UserServicePhoneEncryptionTests()
    {
        _userRepositoryMock = new Mock<IRepository<User>>();
        _userCondominiumRepositoryMock = new Mock<IRepository<UserCondominium>>();
        _condominiumRepositoryMock = new Mock<IRepository<Condominium>>();
        _unitRepositoryMock = new Mock<IRepository<Unit>>();
        _encryptionServiceMock = new Mock<IEncryptionService>();

        _encryptionServiceMock
            .Setup(e => e.Encrypt(It.IsAny<string>()))
            .Returns((string plaintext) => $"enc:{plaintext}");
        _encryptionServiceMock
            .Setup(e => e.Decrypt(It.IsAny<string>()))
            .Returns((string ciphertext) => ciphertext.StartsWith("enc:") ? ciphertext[4..] : ciphertext);

        _userRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userCondominiumRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        _service = new UserService(
            _userRepositoryMock.Object,
            _userCondominiumRepositoryMock.Object,
            _condominiumRepositoryMock.Object,
            _unitRepositoryMock.Object,
            _encryptionServiceMock.Object);
    }

    [Fact]
    public async Task CreateUserAsync_ShouldEncryptSensitiveFieldsAndClearLegacyFields()
    {
        User? createdUser = null;

        _userRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync(Array.Empty<User>());
        _userRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<User>()))
            .Callback<User>(u => createdUser = u)
            .Returns(Task.CompletedTask);

        var result = await _service.CreateUserAsync(new CreateUserRequest
        {
            Name = "Utilizador Teste",
            Email = "utilizador@test.com",
            Phone = "+351910000000",
            Password = "StrongPassword!123",
            Role = "Manager"
        });

        createdUser.Should().NotBeNull();
        createdUser!.Email.Should().BeEmpty();
        createdUser.EmailEncrypted.Should().Be("enc:utilizador@test.com");
        createdUser.EmailHash.Should().NotBeNullOrWhiteSpace();
        createdUser!.Phone.Should().BeEmpty();
        createdUser.PhoneEncrypted.Should().Be("enc:+351910000000");
        result.Email.Should().Be("utilizador@test.com");
        result.Phone.Should().Be("+351910000000");
    }

    [Fact]
    public async Task GetUserByIdAsync_ShouldReturnDecryptedPhone_WhenPhoneEncryptedExists()
    {
        var userId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            Name = "Utilizador Teste",
            Email = string.Empty,
            EmailEncrypted = "enc:utilizador@test.com",
            Phone = string.Empty,
            PhoneEncrypted = "enc:+351911112222",
            PasswordHash = "hash",
            Role = UserRole.Admin,
            IsActive = true
        };

        _userRepositoryMock
            .Setup(r => r.FindWithIncludesAsync(It.IsAny<Expression<Func<User, bool>>>(), It.IsAny<string[]>() ))
            .ReturnsAsync((Expression<Func<User, bool>> predicate, string[] _) => new[] { user }.Where(predicate.Compile()).ToList());

        var result = await _service.GetUserByIdAsync(userId);

        result.Should().NotBeNull();
        result!.Email.Should().Be("utilizador@test.com");
        result!.Phone.Should().Be("+351911112222");
    }

    [Fact]
    public async Task GetUserByIdAsync_ShouldFallbackToLegacyPhone_WhenPhoneEncryptedIsMissing()
    {
        var userId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            Name = "Utilizador Legacy",
            Email = "legacy@test.com",
            Phone = "+351933344455",
            PhoneEncrypted = null,
            PasswordHash = "hash",
            Role = UserRole.Admin,
            IsActive = true
        };

        _userRepositoryMock
            .Setup(r => r.FindWithIncludesAsync(It.IsAny<Expression<Func<User, bool>>>(), It.IsAny<string[]>() ))
            .ReturnsAsync((Expression<Func<User, bool>> predicate, string[] _) => new[] { user }.Where(predicate.Compile()).ToList());

        var result = await _service.GetUserByIdAsync(userId);

        result.Should().NotBeNull();
        result!.Phone.Should().Be("+351933344455");
    }

    [Fact]
    public async Task UpdateUserAsync_ShouldThrow_WhenAnotherUserHasSameEmailHash()
    {
        var userId = Guid.NewGuid();
        var request = new UpdateUserRequest
        {
            Id = userId,
            Name = "Updated Name",
            Email = "conflict@test.com",
            Phone = "+351900000001",
            Role = "Admin",
            IsActive = true
        };

        var existingUser = new User
        {
            Id = userId,
            Name = "Original",
            Email = string.Empty,
            EmailEncrypted = "enc:original@test.com",
            EmailHash = "SOME_OLD_HASH",
            Phone = string.Empty,
            PhoneEncrypted = "enc:+351900000000",
            PasswordHash = "hash",
            Role = UserRole.Admin,
            IsActive = true
        };

        var anotherUser = new User
        {
            Id = Guid.NewGuid(),
            Name = "Other",
            EmailHash = Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash("conflict@test.com"),
            PasswordHash = "hash",
            Role = UserRole.Admin,
            IsActive = true
        };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(existingUser);
        _userRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) => new[] { anotherUser }.Where(predicate.Compile()).ToList());

        var action = async () => await _service.UpdateUserAsync(request);

        await action.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*already exists*");
    }

    [Fact]
    public async Task UpdateUserAsync_ShouldThrow_WhenAnotherUserHasSameLegacyPlainEmail()
    {
        var userId = Guid.NewGuid();
        var request = new UpdateUserRequest
        {
            Id = userId,
            Name = "Updated Name",
            Email = "legacy-conflict@test.com",
            Phone = "+351900000001",
            Role = "Admin",
            IsActive = true
        };

        var existingUser = new User
        {
            Id = userId,
            Name = "Original",
            Email = string.Empty,
            EmailEncrypted = "enc:original@test.com",
            EmailHash = "SOME_OLD_HASH",
            Phone = string.Empty,
            PhoneEncrypted = "enc:+351900000000",
            PasswordHash = "hash",
            Role = UserRole.Admin,
            IsActive = true
        };

        var legacyUser = new User
        {
            Id = Guid.NewGuid(),
            Name = "Legacy",
            Email = "legacy-conflict@test.com",
            EmailHash = null,
            PasswordHash = "hash",
            Role = UserRole.Admin,
            IsActive = true
        };

        var firstFind = true;
        _userRepositoryMock.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(existingUser);
        _userRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) =>
            {
                if (firstFind)
                {
                    firstFind = false;
                    return Array.Empty<User>();
                }

                return new[] { legacyUser }.Where(predicate.Compile()).ToList();
            });

        var action = async () => await _service.UpdateUserAsync(request);

        await action.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*already exists*");
    }

    [Fact]
    public async Task UpdateUserAsync_ShouldAllow_WhenEmailHashBelongsToSameUser()
    {
        var userId = Guid.NewGuid();
        var sameEmail = "same@test.com";
        var sameEmailHash = Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash(sameEmail);

        var request = new UpdateUserRequest
        {
            Id = userId,
            Name = "Updated Name",
            Email = sameEmail,
            Phone = "+351900000001",
            Role = "Admin",
            IsActive = true
        };

        var existingUser = new User
        {
            Id = userId,
            Name = "Original",
            Email = string.Empty,
            EmailEncrypted = "enc:same@test.com",
            EmailHash = sameEmailHash,
            Phone = string.Empty,
            PhoneEncrypted = "enc:+351900000000",
            PasswordHash = "hash",
            Role = UserRole.Admin,
            IsActive = true
        };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(existingUser);

        var result = await _service.UpdateUserAsync(request);

        result.Should().NotBeNull();
        result.Email.Should().Be(sameEmail);
        _userRepositoryMock.Verify(r => r.Update(It.IsAny<User>()), Times.Once);
    }
}

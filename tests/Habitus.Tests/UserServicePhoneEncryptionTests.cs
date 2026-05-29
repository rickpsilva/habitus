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
    public async Task CreateUserAsync_ShouldEncryptPhoneAndClearLegacyField()
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
        createdUser!.Phone.Should().BeEmpty();
        createdUser.PhoneEncrypted.Should().Be("enc:+351910000000");
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
            Email = "utilizador@test.com",
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
}

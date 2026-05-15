using Habitus.Application.DTOs.Users;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using FluentAssertions;
using Moq;

namespace Habitus.Tests;

public class UserServicePhoneEncryptionTests
{
    [Fact]
    public async Task CreateUserAsync_ShouldEncryptPhone_AndReturnDecryptedValue()
    {
        var userRepo = new Mock<IRepository<User>>();
        var userCondoRepo = new Mock<IRepository<UserCondominium>>();
        var condoRepo = new Mock<IRepository<Condominium>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var gdprConsentRepo = new Mock<IRepository<UserGdprConsent>>();
        var notificationRepo = new Mock<IRepository<Notification>>();
        var notificationDispatch = new Mock<INotificationDispatchService>();
        var encryption = new Mock<IEncryptionService>();

        User? addedUser = null;
        userRepo
            .Setup(r => r.AddAsync(It.IsAny<User>()))
            .Callback<User>(u => addedUser = u)
            .Returns(Task.CompletedTask);
        userRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        userRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<System.Func<User, bool>>>()))
            .ReturnsAsync(new List<User>());

        encryption.Setup(e => e.Encrypt("+351912345678")).Returns("enc-phone");
        encryption.Setup(e => e.Decrypt("enc-phone")).Returns("+351912345678");

        var service = new UserService(
            userRepo.Object,
            userCondoRepo.Object,
            condoRepo.Object,
            unitRepo.Object,
            gdprConsentRepo.Object,
            notificationRepo.Object,
            notificationDispatch.Object,
            encryption.Object);

        var request = new CreateUserRequest
        {
            Name = "João Silva",
            Email = "joao@example.com",
            Phone = "+351912345678",
            Password = "SecurePassword123!",
            Role = "Manager"
        };

        var result = await service.CreateUserAsync(request);

        // Verify encryption happened
        addedUser.Should().NotBeNull();
        addedUser!.Phone.Should().BeNull();  // Plaintext cleared
        addedUser!.PhoneEncrypted.Should().Be("enc-phone");

        // Verify response has decrypted phone
        result.Phone.Should().Be("+351912345678");

        encryption.Verify(e => e.Encrypt("+351912345678"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-phone"), Times.Once);
    }

    [Fact]
    public async Task CreateUserAsync_WithEmptyPhone_ShouldNotEncrypt()
    {
        var userRepo = new Mock<IRepository<User>>();
        var userCondoRepo = new Mock<IRepository<UserCondominium>>();
        var condoRepo = new Mock<IRepository<Condominium>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var gdprConsentRepo = new Mock<IRepository<UserGdprConsent>>();
        var notificationRepo = new Mock<IRepository<Notification>>();
        var notificationDispatch = new Mock<INotificationDispatchService>();
        var encryption = new Mock<IEncryptionService>();

        User? addedUser = null;
        userRepo
            .Setup(r => r.AddAsync(It.IsAny<User>()))
            .Callback<User>(u => addedUser = u)
            .Returns(Task.CompletedTask);
        userRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        userRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<System.Func<User, bool>>>()))
            .ReturnsAsync(new List<User>());

        var service = new UserService(
            userRepo.Object,
            userCondoRepo.Object,
            condoRepo.Object,
            unitRepo.Object,
            gdprConsentRepo.Object,
            notificationRepo.Object,
            notificationDispatch.Object,
            encryption.Object);

        var request = new CreateUserRequest
        {
            Name = "João Silva",
            Email = "joao@example.com",
            Phone = "",
            Password = "SecurePassword123!",
            Role = "Manager"
        };

        var result = await service.CreateUserAsync(request);

        addedUser.Should().NotBeNull();
        addedUser!.Phone.Should().Be(string.Empty);
        addedUser!.PhoneEncrypted.Should().BeNull();

        encryption.Verify(e => e.Encrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task UpdateUserAsync_ShouldEncryptPhone_AndClearPlaintext()
    {
        var userId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            Name = "João Silva",
            Email = "joao@example.com",
            Phone = "",
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var userRepo = new Mock<IRepository<User>>();
        var userCondoRepo = new Mock<IRepository<UserCondominium>>();
        var condoRepo = new Mock<IRepository<Condominium>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var gdprConsentRepo = new Mock<IRepository<UserGdprConsent>>();
        var notificationRepo = new Mock<IRepository<Notification>>();
        var notificationDispatch = new Mock<INotificationDispatchService>();
        var encryption = new Mock<IEncryptionService>();

        userRepo.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(user);
        userRepo.Setup(r => r.Update(It.IsAny<User>()));
        userRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Encrypt("+351987654321")).Returns("enc-new-phone");
        encryption.Setup(e => e.Decrypt("enc-new-phone")).Returns("+351987654321");

        var service = new UserService(
            userRepo.Object,
            userCondoRepo.Object,
            condoRepo.Object,
            unitRepo.Object,
            gdprConsentRepo.Object,
            notificationRepo.Object,
            notificationDispatch.Object,
            encryption.Object);

        var request = new UpdateUserRequest
        {
            Id = userId,
            Name = "João Silva",
            Email = "joao@example.com",
            Phone = "+351987654321",
            Role = "0",
            IsActive = true
        };

        var result = await service.UpdateUserAsync(request);

        // Verify encryption happened
        user.Phone.Should().BeNull();
        user.PhoneEncrypted.Should().Be("enc-new-phone");

        // Verify response has decrypted phone
        result.Phone.Should().Be("+351987654321");

        encryption.Verify(e => e.Encrypt("+351987654321"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-new-phone"), Times.Once);
    }

    [Fact]
    public async Task UpdateUserAsync_WithEmptyPhone_ShouldPreserveEncryptedValue()
    {
        var userId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            Name = "João Silva",
            Email = "joao@example.com",
            Phone = null,
            PhoneEncrypted = "enc-existing-phone",
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var userRepo = new Mock<IRepository<User>>();
        var userCondoRepo = new Mock<IRepository<UserCondominium>>();
        var condoRepo = new Mock<IRepository<Condominium>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var gdprConsentRepo = new Mock<IRepository<UserGdprConsent>>();
        var notificationRepo = new Mock<IRepository<Notification>>();
        var notificationDispatch = new Mock<INotificationDispatchService>();
        var encryption = new Mock<IEncryptionService>();

        userRepo.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(user);
        userRepo.Setup(r => r.Update(It.IsAny<User>()));
        userRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Decrypt("enc-existing-phone")).Returns("+351912345678");

        var service = new UserService(
            userRepo.Object,
            userCondoRepo.Object,
            condoRepo.Object,
            unitRepo.Object,
            gdprConsentRepo.Object,
            notificationRepo.Object,
            notificationDispatch.Object,
            encryption.Object);

        var request = new UpdateUserRequest
        {
            Id = userId,
            Name = "João Silva",
            Email = "joao@example.com",
            Phone = "",  // Omitted/empty phone
            Role = "0",
            IsActive = true
        };

        var result = await service.UpdateUserAsync(request);

        // Verify encrypted value was preserved
        user.PhoneEncrypted.Should().Be("enc-existing-phone");

        // Verify response still has decrypted phone
        result.Phone.Should().Be("+351912345678");

        encryption.Verify(e => e.Encrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task MapToResponse_WithPhoneEncrypted_ShouldDecrypt()
    {
        var userId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            Name = "João Silva",
            Email = "joao@example.com",
            Phone = null,
            PhoneEncrypted = "enc-phone",
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var userRepo = new Mock<IRepository<User>>();
        var userCondoRepo = new Mock<IRepository<UserCondominium>>();
        var condoRepo = new Mock<IRepository<Condominium>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var gdprConsentRepo = new Mock<IRepository<UserGdprConsent>>();
        var notificationRepo = new Mock<IRepository<Notification>>();
        var notificationDispatch = new Mock<INotificationDispatchService>();
        var encryption = new Mock<IEncryptionService>();

        userRepo.Setup(r => r.FindWithIncludesAsync(
            It.IsAny<System.Linq.Expressions.Expression<System.Func<User, bool>>>(),
            It.IsAny<string[]>()))
            .ReturnsAsync(new[] { user });

        encryption.Setup(e => e.Decrypt("enc-phone")).Returns("+351912345678");

        var service = new UserService(
            userRepo.Object,
            userCondoRepo.Object,
            condoRepo.Object,
            unitRepo.Object,
            gdprConsentRepo.Object,
            notificationRepo.Object,
            notificationDispatch.Object,
            encryption.Object);

        var result = await service.GetUserByIdAsync(userId);

        result.Should().NotBeNull();
        result!.Phone.Should().Be("+351912345678");

        encryption.Verify(e => e.Decrypt("enc-phone"), Times.Once);
    }

    [Fact]
    public async Task MapToResponse_WithPlaintextPhone_ShouldReturnFallback()
    {
        var userId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            Name = "João Silva",
            Email = "joao@example.com",
            Phone = "+351912345678",  // Legacy plaintext
            PhoneEncrypted = null,
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var userRepo = new Mock<IRepository<User>>();
        var userCondoRepo = new Mock<IRepository<UserCondominium>>();
        var condoRepo = new Mock<IRepository<Condominium>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var gdprConsentRepo = new Mock<IRepository<UserGdprConsent>>();
        var notificationRepo = new Mock<IRepository<Notification>>();
        var notificationDispatch = new Mock<INotificationDispatchService>();
        var encryption = new Mock<IEncryptionService>();

        userRepo.Setup(r => r.FindWithIncludesAsync(
            It.IsAny<System.Linq.Expressions.Expression<System.Func<User, bool>>>(),
            It.IsAny<string[]>()))
            .ReturnsAsync(new[] { user });

        var service = new UserService(
            userRepo.Object,
            userCondoRepo.Object,
            condoRepo.Object,
            unitRepo.Object,
            gdprConsentRepo.Object,
            notificationRepo.Object,
            notificationDispatch.Object,
            encryption.Object);

        var result = await service.GetUserByIdAsync(userId);

        result.Should().NotBeNull();
        result!.Phone.Should().Be("+351912345678");

        encryption.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);
    }
}

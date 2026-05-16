using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Moq;

namespace Habitus.Tests;

public class UsefulContactServiceEncryptionTests
{
    [Fact]
    public async Task CreateAsync_ShouldEncryptPhoneNumber()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var condominiumId = Guid.NewGuid();

        repository.Setup(r => r.AddAsync(It.IsAny<UsefulContact>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Encrypt("912345678")).Returns("enc-phone");
        encryption.Setup(e => e.Decrypt("enc-phone")).Returns("912345678");

        var service = new UsefulContactService(repository.Object, encryption.Object);

        var contact = await service.CreateAsync(condominiumId, "Emergency Contact", "912345678", ContactCategory.Emergency);

        contact.Phone.Should().Be("912345678");
        contact.CondominiumId.Should().Be(condominiumId);
        contact.Name.Should().Be("Emergency Contact");
        contact.Category.Should().Be(ContactCategory.Emergency);

        encryption.Verify(e => e.Encrypt("912345678"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-phone"), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_WithEmptyPhone_ShouldNotEncrypt()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var condominiumId = Guid.NewGuid();

        repository.Setup(r => r.AddAsync(It.IsAny<UsefulContact>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var service = new UsefulContactService(repository.Object, encryption.Object);

        var contact = await service.CreateAsync(condominiumId, "Service", string.Empty, ContactCategory.Service);

        contact.Phone.Should().Be(string.Empty);
        encryption.Verify(e => e.Encrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WithWhitespacePhone_ShouldNotEncrypt()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var condominiumId = Guid.NewGuid();

        repository.Setup(r => r.AddAsync(It.IsAny<UsefulContact>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var service = new UsefulContactService(repository.Object, encryption.Object);

        var contact = await service.CreateAsync(condominiumId, "Service", "   ", ContactCategory.Service);

        contact.Phone.Should().Be(string.Empty);
        encryption.Verify(e => e.Encrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_ShouldEncryptPhoneNumber_WhenProvided()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var contactId = Guid.NewGuid();

        var existing = new UsefulContact
        {
            Id = contactId,
            CondominiumId = Guid.NewGuid(),
            Name = "Old Contact",
            Phone = "old-phone",
            Category = ContactCategory.Emergency,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(contactId)).ReturnsAsync(existing);
        repository.Setup(r => r.Update(It.IsAny<UsefulContact>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Encrypt("987654321")).Returns("enc-new-phone");
        encryption.Setup(e => e.Decrypt("enc-new-phone")).Returns("987654321");

        var service = new UsefulContactService(repository.Object, encryption.Object);

        var contact = await service.UpdateAsync(contactId, "Updated Contact", "987654321", ContactCategory.Service);

        contact!.Name.Should().Be("Updated Contact");
        contact.Phone.Should().Be("987654321");
        contact.Category.Should().Be(ContactCategory.Service);

        encryption.Verify(e => e.Encrypt("987654321"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-new-phone"), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_ShouldPreserveEncryptedPhone_WhenOmitted()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var contactId = Guid.NewGuid();

        var existing = new UsefulContact
        {
            Id = contactId,
            CondominiumId = Guid.NewGuid(),
            Name = "Contact Name",
            Phone = string.Empty,
            PhoneEncrypted = "enc-existing-phone",
            Category = ContactCategory.Emergency,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(contactId)).ReturnsAsync(existing);
        repository.Setup(r => r.Update(It.IsAny<UsefulContact>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Decrypt("enc-existing-phone")).Returns("912345678");

        var service = new UsefulContactService(repository.Object, encryption.Object);

        var contact = await service.UpdateAsync(contactId, "Same Contact", null, ContactCategory.Service);

        contact!.Name.Should().Be("Same Contact");
        contact.Phone.Should().Be("912345678");
        contact.Category.Should().Be(ContactCategory.Service);

        encryption.Verify(e => e.Encrypt(It.IsAny<string>()), Times.Never);
        encryption.Verify(e => e.Decrypt("enc-existing-phone"), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_WithWhitespacePhone_ShouldClearEncryptedPhone()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var contactId = Guid.NewGuid();

        var existing = new UsefulContact
        {
            Id = contactId,
            CondominiumId = Guid.NewGuid(),
            Name = "Contact Name",
            Phone = string.Empty,
            PhoneEncrypted = "enc-existing-phone",
            Category = ContactCategory.Emergency,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(contactId)).ReturnsAsync(existing);
        repository.Setup(r => r.Update(It.IsAny<UsefulContact>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var service = new UsefulContactService(repository.Object, encryption.Object);

        var contact = await service.UpdateAsync(contactId, "Same Contact", "   ", ContactCategory.Service);

        contact.Should().NotBeNull();
        existing.PhoneEncrypted.Should().BeNull();
        contact!.Phone.Should().Be(string.Empty);
        encryption.Verify(e => e.Encrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetByIdAsync_ShouldHideLegacyPlaintext_WhenFallbackDisabled()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var contactId = Guid.NewGuid();

        var existing = new UsefulContact
        {
            Id = contactId,
            CondominiumId = Guid.NewGuid(),
            Name = "Contact",
            Phone = "912345678",
            PhoneEncrypted = null,
            Category = ContactCategory.Emergency,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(contactId)).ReturnsAsync(existing);

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Rgpd:AllowLegacyPlaintextFallback"] = "false"
        }).Build();

        var service = new UsefulContactService(repository.Object, encryption.Object, configuration);

        var contact = await service.GetByIdAsync(contactId);

        contact.Should().NotBeNull();
        contact!.Phone.Should().Be(string.Empty);
        encryption.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetByIdAsync_ShouldDecryptPhone()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var contactId = Guid.NewGuid();

        var existing = new UsefulContact
        {
            Id = contactId,
            CondominiumId = Guid.NewGuid(),
            Name = "Contact",
            Phone = string.Empty,
            PhoneEncrypted = "enc-phone",
            Category = ContactCategory.Emergency,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(contactId)).ReturnsAsync(existing);
        encryption.Setup(e => e.Decrypt("enc-phone")).Returns("912345678");

        var service = new UsefulContactService(repository.Object, encryption.Object);

        var contact = await service.GetByIdAsync(contactId);

        contact.Should().NotBeNull();
        contact!.Phone.Should().Be("912345678");
        encryption.Verify(e => e.Decrypt("enc-phone"), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_ShouldReturnTrue_WhenContactExists()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var contactId = Guid.NewGuid();

        var existing = new UsefulContact
        {
            Id = contactId,
            CondominiumId = Guid.NewGuid(),
            Name = "Contact",
            Phone = "912345678",
            Category = ContactCategory.Emergency,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(contactId)).ReturnsAsync(existing);
        repository.Setup(r => r.Remove(It.IsAny<UsefulContact>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var service = new UsefulContactService(repository.Object, encryption.Object);

        var result = await service.DeleteAsync(contactId);

        result.Should().BeTrue();
        repository.Verify(r => r.Remove(existing), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_ShouldReturnFalse_WhenContactDoesNotExist()
    {
        var repository = new Mock<IRepository<UsefulContact>>();
        var encryption = new Mock<IEncryptionService>();
        var contactId = Guid.NewGuid();

        repository.Setup(r => r.GetByIdAsync(contactId)).ReturnsAsync((UsefulContact?)null);

        var service = new UsefulContactService(repository.Object, encryption.Object);

        var result = await service.DeleteAsync(contactId);

        result.Should().BeFalse();
        repository.Verify(r => r.Remove(It.IsAny<UsefulContact>()), Times.Never);
    }
}

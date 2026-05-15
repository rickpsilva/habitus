using FluentAssertions;
using Habitus.Application.DTOs.Suppliers;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class SupplierServiceEncryptionTests
{
    [Fact]
    public async Task CreateAsync_ShouldEncryptSensitiveFields()
    {
        var repository = new Mock<IRepository<Supplier>>();
        var encryption = new Mock<IEncryptionService>();
        var condominiumId = Guid.NewGuid();

        repository.Setup(r => r.AddAsync(It.IsAny<Supplier>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Encrypt("contact@supplier.com")).Returns("enc-email");
        encryption.Setup(e => e.Encrypt("912345678")).Returns("enc-phone");
        encryption.Setup(e => e.Encrypt("Rua de Exemplo, 123")).Returns("enc-address");
        encryption.Setup(e => e.Decrypt("enc-email")).Returns("contact@supplier.com");
        encryption.Setup(e => e.Decrypt("enc-phone")).Returns("912345678");
        encryption.Setup(e => e.Decrypt("enc-address")).Returns("Rua de Exemplo, 123");

        var service = new SupplierService(repository.Object, encryption.Object);

        var request = new CreateSupplierRequest
        {
            Name = "ABC Services",
            Contact = "John",
            Email = "contact@supplier.com",
            Phone = "912345678",
            Address = "Rua de Exemplo, 123",
            Specialty = "Electrical",
            CondominiumId = condominiumId.ToString()
        };

        var result = await service.CreateAsync(request);

        result.Name.Should().Be("ABC Services");
        result.Email.Should().Be("contact@supplier.com");
        result.Phone.Should().Be("912345678");
        result.Address.Should().Be("Rua de Exemplo, 123");

        encryption.Verify(e => e.Encrypt("contact@supplier.com"), Times.Once);
        encryption.Verify(e => e.Encrypt("912345678"), Times.Once);
        encryption.Verify(e => e.Encrypt("Rua de Exemplo, 123"), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_ShouldEncryptChangedFields()
    {
        var repository = new Mock<IRepository<Supplier>>();
        var encryption = new Mock<IEncryptionService>();
        var supplierId = Guid.NewGuid();

        var existing = new Supplier
        {
            Id = supplierId,
            CondominiumId = Guid.NewGuid(),
            Name = "Old Name",
            Contact = "Old Contact",
            Email = "old@supplier.com",
            EmailEncrypted = "enc-old-email",
            Phone = string.Empty,
            PhoneEncrypted = "enc-old-phone",
            Address = string.Empty,
            AddressEncrypted = "enc-old-address",
            Specialty = "Old Specialty",
            IsActive = true,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(supplierId)).ReturnsAsync(existing);
        repository.Setup(r => r.Update(It.IsAny<Supplier>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Encrypt("new@supplier.com")).Returns("enc-new-email");
        encryption.Setup(e => e.Encrypt("987654321")).Returns("enc-new-phone");
        encryption.Setup(e => e.Decrypt("enc-new-email")).Returns("new@supplier.com");
        encryption.Setup(e => e.Decrypt("enc-new-phone")).Returns("987654321");

        var service = new SupplierService(repository.Object, encryption.Object);

        var request = new UpdateSupplierRequest
        {
            Name = "New Name",
            Contact = "New Contact",
            Email = "new@supplier.com",
            Phone = "987654321",
            Address = null,  // Omitted - should preserve existing
            Specialty = "New Specialty",
            IsActive = true
        };

        var result = await service.UpdateAsync(supplierId, request);

        result!.Name.Should().Be("New Name");
        result.Email.Should().Be("new@supplier.com");
        result.Phone.Should().Be("987654321");

        encryption.Verify(e => e.Encrypt("new@supplier.com"), Times.Once);
        encryption.Verify(e => e.Encrypt("987654321"), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_ShouldPreserveEncryptedFields_WhenOmitted()
    {
        var repository = new Mock<IRepository<Supplier>>();
        var encryption = new Mock<IEncryptionService>();
        var supplierId = Guid.NewGuid();

        var existing = new Supplier
        {
            Id = supplierId,
            CondominiumId = Guid.NewGuid(),
            Name = "Name",
            Contact = "Contact",
            Email = string.Empty,
            EmailEncrypted = "enc-email",
            Phone = string.Empty,
            PhoneEncrypted = "enc-phone",
            Address = string.Empty,
            AddressEncrypted = "enc-address",
            Specialty = "Specialty",
            IsActive = true,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(supplierId)).ReturnsAsync(existing);
        repository.Setup(r => r.Update(It.IsAny<Supplier>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Decrypt("enc-email")).Returns("original@supplier.com");
        encryption.Setup(e => e.Decrypt("enc-phone")).Returns("912345678");
        encryption.Setup(e => e.Decrypt("enc-address")).Returns("Rua Original, 456");

        var service = new SupplierService(repository.Object, encryption.Object);

        var request = new UpdateSupplierRequest
        {
            Name = "Updated Name",
            Contact = "Contact",
            Email = null,  // Omitted - preserve
            Phone = null,  // Omitted - preserve
            Address = null,  // Omitted - preserve
            Specialty = "Specialty",
            IsActive = true
        };

        var result = await service.UpdateAsync(supplierId, request);

        result!.Email.Should().Be("original@supplier.com");
        result.Phone.Should().Be("912345678");
        result.Address.Should().Be("Rua Original, 456");

        encryption.Verify(e => e.Encrypt(It.IsAny<string>()), Times.Never);
        encryption.Verify(e => e.Decrypt("enc-email"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-phone"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-address"), Times.Once);
    }

    [Fact]
    public async Task GetByIdAsync_ShouldDecryptAllFields()
    {
        var repository = new Mock<IRepository<Supplier>>();
        var encryption = new Mock<IEncryptionService>();
        var supplierId = Guid.NewGuid();

        var existing = new Supplier
        {
            Id = supplierId,
            CondominiumId = Guid.NewGuid(),
            Name = "Supplier",
            Contact = "Contact",
            Email = string.Empty,
            EmailEncrypted = "enc-email",
            Phone = string.Empty,
            PhoneEncrypted = "enc-phone",
            Address = string.Empty,
            AddressEncrypted = "enc-address",
            Specialty = "Specialty",
            IsActive = true,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(supplierId)).ReturnsAsync(existing);
        encryption.Setup(e => e.Decrypt("enc-email")).Returns("contact@supplier.com");
        encryption.Setup(e => e.Decrypt("enc-phone")).Returns("912345678");
        encryption.Setup(e => e.Decrypt("enc-address")).Returns("Rua de Exemplo, 789");

        var service = new SupplierService(repository.Object, encryption.Object);

        var result = await service.GetByIdAsync(supplierId);

        result.Should().NotBeNull();
        result!.Email.Should().Be("contact@supplier.com");
        result.Phone.Should().Be("912345678");
        result.Address.Should().Be("Rua de Exemplo, 789");

        encryption.Verify(e => e.Decrypt("enc-email"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-phone"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-address"), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_ShouldReturnTrue_WhenSupplierExists()
    {
        var repository = new Mock<IRepository<Supplier>>();
        var encryption = new Mock<IEncryptionService>();
        var supplierId = Guid.NewGuid();

        var existing = new Supplier
        {
            Id = supplierId,
            CondominiumId = Guid.NewGuid(),
            Name = "Supplier",
            Contact = "Contact",
            Email = "contact@supplier.com",
            Phone = "912345678",
            Address = "Address",
            Specialty = "Specialty",
            IsActive = true,
            Condominium = null!
        };

        repository.Setup(r => r.GetByIdAsync(supplierId)).ReturnsAsync(existing);
        repository.Setup(r => r.Remove(It.IsAny<Supplier>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var service = new SupplierService(repository.Object, encryption.Object);

        var result = await service.DeleteAsync(supplierId);

        result.Should().BeTrue();
        repository.Verify(r => r.Remove(existing), Times.Once);
    }

    [Fact]
    public async Task GetAllAsync_ShouldDecryptAllSuppliers()
    {
        var repository = new Mock<IRepository<Supplier>>();
        var encryption = new Mock<IEncryptionService>();

        var suppliers = new List<Supplier>
        {
            new()
            {
                Id = Guid.NewGuid(),
                CondominiumId = Guid.NewGuid(),
                Name = "Supplier 1",
                Contact = "Contact1",
                Email = string.Empty,
                EmailEncrypted = "enc-email1",
                Phone = string.Empty,
                PhoneEncrypted = "enc-phone1",
                Address = string.Empty,
                AddressEncrypted = "enc-address1",
                Specialty = "Specialty1",
                IsActive = true,
                Condominium = null!
            }
        };

        repository.Setup(r => r.GetAllAsync()).ReturnsAsync(suppliers);
        encryption.Setup(e => e.Decrypt("enc-email1")).Returns("contact1@supplier.com");
        encryption.Setup(e => e.Decrypt("enc-phone1")).Returns("911111111");
        encryption.Setup(e => e.Decrypt("enc-address1")).Returns("Rua 1, 100");

        var service = new SupplierService(repository.Object, encryption.Object);

        var results = await service.GetAllAsync();

        results.Should().HaveCount(1);
        var first = results.First();
        first.Name.Should().Be("Supplier 1");
        first.Email.Should().Be("contact1@supplier.com");
        first.Phone.Should().Be("911111111");
        first.Address.Should().Be("Rua 1, 100");
    }
}

using Habitus.Application.DTOs.Condominium;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using FluentAssertions;
using Moq;

namespace Habitus.Tests;

public class CondominiumServiceEncryptionTests
{
    [Fact]
    public async Task CreateCondominiumAsync_ShouldEncryptTaxId_AndReturnDecryptedValue()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var userRepo = new Mock<IRepository<User>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var paymentSettingsRepo = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();

        Condominium? added = null;
        condominiumRepo
            .Setup(r => r.AddAsync(It.IsAny<Condominium>()))
            .Callback<Condominium>(c => added = c)
            .Returns(Task.CompletedTask);
        condominiumRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Encrypt("123456789")).Returns("enc-taxid");
        encryption.Setup(e => e.Decrypt("enc-taxid")).Returns("123456789");

        var service = new CondominiumService(
            condominiumRepo.Object,
            userRepo.Object,
            unitRepo.Object,
            paymentSettingsRepo.Object,
            encryption.Object);

        var request = new CreateCondominiumRequest
        {
            Name = "Condo A",
            Address = "Street 1",
            TaxId = "123456789",
            Email = "condo@example.com",
        };

        var result = await service.CreateCondominiumAsync(request);

        added.Should().NotBeNull();
        added!.TaxId.Should().BeNull();
        added!.TaxIdEncrypted.Should().Be("enc-taxid");
        result.TaxId.Should().Be("123456789");

        encryption.Verify(e => e.Encrypt("123456789"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-taxid"), Times.Once);
    }

    [Fact]
    public async Task UpdateCondominiumAsync_ShouldEncryptTaxId_AndClearPlaintext()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var userRepo = new Mock<IRepository<User>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var paymentSettingsRepo = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();

        var condominiumId = Guid.NewGuid();
        var condominium = new Condominium
        {
            Id = condominiumId,
            Name = "Condo A",
            Address = "Street 1",
            TaxId = "123456789",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        condominiumRepo.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(condominium);
        condominiumRepo.Setup(r => r.Update(It.IsAny<Condominium>()));
        condominiumRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        userRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<User, bool>>>() ))
            .ReturnsAsync(new List<User>());
        unitRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Unit, bool>>>() ))
            .ReturnsAsync(new List<Unit>());

        encryption.Setup(e => e.Encrypt("987654321")).Returns("enc-taxid-updated");
        encryption.Setup(e => e.Decrypt("enc-taxid-updated")).Returns("987654321");

        var service = new CondominiumService(
            condominiumRepo.Object,
            userRepo.Object,
            unitRepo.Object,
            paymentSettingsRepo.Object,
            encryption.Object);

        var request = new UpdateCondominiumRequest
        {
            Id = condominiumId,
            Name = "Condo A Updated",
            Address = "Street 2",
            TaxId = "987654321",
            Email = "updated@example.com",
            IsActive = true,
        };

        var result = await service.UpdateCondominiumAsync(request);

        condominium.TaxId.Should().BeNull();
        condominium.TaxIdEncrypted.Should().Be("enc-taxid-updated");
        result.TaxId.Should().Be("987654321");

        encryption.Verify(e => e.Encrypt("987654321"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-taxid-updated"), Times.Once);
    }

    [Fact]
    public async Task UpdateCondominiumAsync_ShouldPreserveEncryptedTaxId_WhenTaxIdIsOmitted()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var userRepo = new Mock<IRepository<User>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var paymentSettingsRepo = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();

        var condominiumId = Guid.NewGuid();
        var condominium = new Condominium
        {
            Id = condominiumId,
            Name = "Condo A",
            Address = "Street 1",
            TaxId = null,
            TaxIdEncrypted = "enc-existing-taxid",
            Email = "before@example.com",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        condominiumRepo.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(condominium);
        condominiumRepo.Setup(r => r.Update(It.IsAny<Condominium>()));
        condominiumRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        userRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<User, bool>>>() ))
            .ReturnsAsync(new List<User>());
        unitRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Unit, bool>>>() ))
            .ReturnsAsync(new List<Unit>());

        encryption.Setup(e => e.Decrypt("enc-existing-taxid")).Returns("123456789");

        var service = new CondominiumService(
            condominiumRepo.Object,
            userRepo.Object,
            unitRepo.Object,
            paymentSettingsRepo.Object,
            encryption.Object);

        var request = new UpdateCondominiumRequest
        {
            Id = condominiumId,
            Name = "Condo A Updated",
            Address = "Street 2",
            TaxId = null,
            Email = "updated@example.com",
            IsActive = true,
        };

        var result = await service.UpdateCondominiumAsync(request);

        condominium.TaxIdEncrypted.Should().Be("enc-existing-taxid");
        condominium.TaxId.Should().BeNull();
        result.TaxId.Should().Be("123456789");

        encryption.Verify(e => e.Encrypt(It.IsAny<string>()), Times.Never);
        encryption.Verify(e => e.Decrypt("enc-existing-taxid"), Times.Once);
    }

    [Fact]
    public async Task GetAllCondominiumsAsync_ShouldDecryptEncryptedTaxId()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var userRepo = new Mock<IRepository<User>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var paymentSettingsRepo = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();

        var condominiumId = Guid.NewGuid();
        condominiumRepo.Setup(r => r.GetAllAsync()).ReturnsAsync(new List<Condominium>
        {
            new()
            {
                Id = condominiumId,
                Name = "Condo A",
                Address = "Street 1",
                TaxIdEncrypted = "enc-taxid",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            }
        });

        userRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<User, bool>>>() ))
            .ReturnsAsync(new List<User>());
        unitRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Unit, bool>>>() ))
            .ReturnsAsync(new List<Unit>());

        encryption.Setup(e => e.Decrypt("enc-taxid")).Returns("123456789");

        var service = new CondominiumService(
            condominiumRepo.Object,
            userRepo.Object,
            unitRepo.Object,
            paymentSettingsRepo.Object,
            encryption.Object);

        var result = (await service.GetAllCondominiumsAsync()).ToList();

        result.Should().HaveCount(1);
        result[0].TaxId.Should().Be("123456789");
        encryption.Verify(e => e.Decrypt("enc-taxid"), Times.Once);
    }

    [Fact]
    public async Task UpdatePaymentMethodsAsync_ShouldEncryptIban_AndReturnDecryptedValue()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var userRepo = new Mock<IRepository<User>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var paymentSettingsRepo = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();

        var condominium = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = "Condo A",
            Address = "Street 1",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        condominiumRepo.Setup(r => r.GetByIdAsync(condominium.Id)).ReturnsAsync(condominium);
        condominiumRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        condominiumRepo.Setup(r => r.Update(It.IsAny<Condominium>()));

        encryption.Setup(e => e.Encrypt("PT50000201231234567890154")).Returns("enc-iban");
        encryption.Setup(e => e.Decrypt("enc-iban")).Returns("PT50000201231234567890154");

        var service = new CondominiumService(
            condominiumRepo.Object,
            userRepo.Object,
            unitRepo.Object,
            paymentSettingsRepo.Object,
            encryption.Object);

        var request = new UpdatePaymentMethodsRequest
        {
            Iban = "PT50000201231234567890154",
            Instructions = "Transfer by end of month",
            MbWay = "910000000",
            MbReference = "12345",
            BankTransferEnabled = true,
            MbWayEnabled = true,
            CardEnabled = false,
        };

        var result = await service.UpdatePaymentMethodsAsync(condominium.Id, request);

        condominium.PaymentIban.Should().BeNull();
        condominium.PaymentIbanEncrypted.Should().Be("enc-iban");
        result.Iban.Should().Be("PT50000201231234567890154");

        encryption.Verify(e => e.Encrypt("PT50000201231234567890154"), Times.Once);
        encryption.Verify(e => e.Decrypt("enc-iban"), Times.Once);
    }

    [Fact]
    public async Task GetPaymentMethodsAsync_ShouldDecryptIban_FromPaymentSettings()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var userRepo = new Mock<IRepository<User>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var paymentSettingsRepo = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();

        var condominiumId = Guid.NewGuid();
        condominiumRepo.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(new Condominium
        {
            Id = condominiumId,
            Name = "Condo A",
            Address = "Street 1",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });

        paymentSettingsRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<PaymentSettings, bool>>>() ))
            .ReturnsAsync(new List<PaymentSettings>
            {
                new()
                {
                    CondominiumId = condominiumId,
                    BankTransferEnabled = true,
                    BankTransferIbanEncrypted = "enc-iban",
                    MBWayEnabled = true,
                    MBWayPhoneNumber = "910000000",
                    CardEnabled = false,
                }
            });

        encryption.Setup(e => e.Decrypt("enc-iban")).Returns("PT50000201231234567890154");

        var service = new CondominiumService(
            condominiumRepo.Object,
            userRepo.Object,
            unitRepo.Object,
            paymentSettingsRepo.Object,
            encryption.Object);

        var result = await service.GetPaymentMethodsAsync(condominiumId);

        result.Should().NotBeNull();
        result!.Iban.Should().Be("PT50000201231234567890154");
        result.MbWay.Should().Be("910000000");
        encryption.Verify(e => e.Decrypt("enc-iban"), Times.Once);
    }

    [Fact]
    public async Task GetPaymentMethodsAsync_ShouldDecryptIban_FromCondominiumFallback_WhenSettingsMissing()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var userRepo = new Mock<IRepository<User>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var paymentSettingsRepo = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();

        var condominiumId = Guid.NewGuid();
        condominiumRepo.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(new Condominium
        {
            Id = condominiumId,
            Name = "Condo A",
            Address = "Street 1",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            PaymentIbanEncrypted = "enc-legacy-iban",
            PaymentBankTransferEnabled = true,
            PaymentMbWayEnabled = false,
            PaymentCardEnabled = true,
        });

        paymentSettingsRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<PaymentSettings, bool>>>() ))
            .ReturnsAsync(new List<PaymentSettings>());

        encryption.Setup(e => e.Decrypt("enc-legacy-iban")).Returns("PT50000201239999999999999");

        var service = new CondominiumService(
            condominiumRepo.Object,
            userRepo.Object,
            unitRepo.Object,
            paymentSettingsRepo.Object,
            encryption.Object);

        var result = await service.GetPaymentMethodsAsync(condominiumId);

        result.Should().NotBeNull();
        result!.Iban.Should().Be("PT50000201239999999999999");
        result.BankTransferEnabled.Should().BeTrue();
        result.CardEnabled.Should().BeTrue();
        encryption.Verify(e => e.Decrypt("enc-legacy-iban"), Times.Once);
    }

    [Fact]
    public async Task GetPaymentMethodsAsync_ShouldNotDecrypt_FromPaymentSettings_WhenEncryptedIbanMissing()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var userRepo = new Mock<IRepository<User>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var paymentSettingsRepo = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();

        var condominiumId = Guid.NewGuid();
        condominiumRepo.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(new Condominium
        {
            Id = condominiumId,
            Name = "Condo A",
            Address = "Street 1",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });

        paymentSettingsRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<PaymentSettings, bool>>>() ))
            .ReturnsAsync(new List<PaymentSettings>
            {
                new()
                {
                    CondominiumId = condominiumId,
                    BankTransferEnabled = true,
                    BankTransferIban = "PT50000201230000000000000",
                    BankTransferIbanEncrypted = null,
                    MBWayEnabled = false,
                    CardEnabled = false,
                }
            });

        var service = new CondominiumService(
            condominiumRepo.Object,
            userRepo.Object,
            unitRepo.Object,
            paymentSettingsRepo.Object,
            encryption.Object);

        var result = await service.GetPaymentMethodsAsync(condominiumId);

        result.Should().NotBeNull();
        result!.Iban.Should().Be("PT50000201230000000000000");
        encryption.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetPaymentMethodsAsync_ShouldNotDecrypt_FromCondominiumFallback_WhenEncryptedIbanMissing()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var userRepo = new Mock<IRepository<User>>();
        var unitRepo = new Mock<IRepository<Unit>>();
        var paymentSettingsRepo = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();

        var condominiumId = Guid.NewGuid();
        condominiumRepo.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(new Condominium
        {
            Id = condominiumId,
            Name = "Condo A",
            Address = "Street 1",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            PaymentIban = "PT50000201239999999999998",
            PaymentIbanEncrypted = string.Empty,
            PaymentBankTransferEnabled = true,
            PaymentMbWayEnabled = false,
            PaymentCardEnabled = false,
        });

        paymentSettingsRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<PaymentSettings, bool>>>() ))
            .ReturnsAsync(new List<PaymentSettings>());

        var service = new CondominiumService(
            condominiumRepo.Object,
            userRepo.Object,
            unitRepo.Object,
            paymentSettingsRepo.Object,
            encryption.Object);

        var result = await service.GetPaymentMethodsAsync(condominiumId);

        result.Should().NotBeNull();
        result!.Iban.Should().Be("PT50000201239999999999998");
        encryption.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);
    }
}

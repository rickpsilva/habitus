using FluentAssertions;
using Habitus.Application.DTOs.Payments;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class PaymentSettingsServiceEncryptionTests
{
    [Fact]
    public async Task GetAsync_ShouldReturnDefaults_WhenSettingsDoNotExist()
    {
        var repository = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();
        var condominiumId = Guid.NewGuid();

        repository
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<PaymentSettings, bool>>>() ))
            .ReturnsAsync(new List<PaymentSettings>());

        var service = new PaymentSettingsService(repository.Object, encryption.Object);

        var result = await service.GetAsync(condominiumId);

        result.CondominiumId.Should().Be(condominiumId);
        result.Id.Should().Be(Guid.Empty);
        result.BankTransferEnabled.Should().BeTrue();
        result.CardEnabled.Should().BeFalse();
        encryption.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetAsync_ShouldDecryptIban_WhenEncryptedIbanExists()
    {
        var repository = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();
        var condominiumId = Guid.NewGuid();

        repository
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<PaymentSettings, bool>>>() ))
            .ReturnsAsync(new List<PaymentSettings>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    CondominiumId = condominiumId,
                    BankTransferEnabled = true,
                    BankTransferIbanEncrypted = "enc-iban",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                }
            });

        encryption.Setup(e => e.Decrypt("enc-iban")).Returns("PT50000201231234567890154");

        var service = new PaymentSettingsService(repository.Object, encryption.Object);

        var result = await service.GetAsync(condominiumId);

        result.BankTransferIban.Should().Be("PT50000201231234567890154");
        encryption.Verify(e => e.Decrypt("enc-iban"), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_ShouldEncryptSensitiveFields_WhenProvided()
    {
        var repository = new Mock<IRepository<PaymentSettings>>();
        var encryption = new Mock<IEncryptionService>();
        var condominiumId = Guid.NewGuid();

        var existing = new PaymentSettings
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CardSecretKey = "legacy-secret"
        };

        repository
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<PaymentSettings, bool>>>() ))
            .ReturnsAsync(new List<PaymentSettings> { existing });
        repository.Setup(r => r.Update(It.IsAny<PaymentSettings>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Encrypt("PT50000201231234567890154")).Returns("enc-iban");
        encryption.Setup(e => e.Encrypt("sk_test_secret")).Returns("enc-secret");
        encryption.Setup(e => e.Decrypt("enc-iban")).Returns("PT50000201231234567890154");

        var service = new PaymentSettingsService(repository.Object, encryption.Object);

        var request = new UpdatePaymentSettingsRequest
        {
            BankTransferEnabled = true,
            BankTransferIban = "PT50000201231234567890154",
            BankTransferAccountHolder = "Condo A",
            MBReferenceEnabled = false,
            MBWayEnabled = false,
            CardEnabled = true,
            CardProvider = "stripe",
            CardPublicKey = "pk_test_public",
            CardSecretKey = "sk_test_secret",
            CardMerchantId = "merchant-1",
        };

        var result = await service.UpdateAsync(condominiumId, request);

        existing.BankTransferIbanEncrypted.Should().Be("enc-iban");
        existing.BankTransferIban.Should().BeNull();
        existing.CardSecretKeyEncrypted.Should().Be("enc-secret");
        existing.CardSecretKey.Should().BeNull();
        result.BankTransferIban.Should().Be("PT50000201231234567890154");

        encryption.Verify(e => e.Encrypt("PT50000201231234567890154"), Times.Once);
        encryption.Verify(e => e.Encrypt("sk_test_secret"), Times.Once);
    }
}

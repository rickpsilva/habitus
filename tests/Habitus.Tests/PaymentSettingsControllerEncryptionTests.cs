using FluentAssertions;
using Habitus.Api.Controllers;
using Habitus.Application.DTOs.Payments;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace Habitus.Tests;

public class PaymentSettingsControllerEncryptionTests
{
    [Fact]
    public async Task Get_ShouldDecryptBankTransferIban_WhenEncryptedValueExists()
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

        var controller = new PaymentSettingsController(repository.Object, encryption.Object);

        var actionResult = await controller.Get(condominiumId);

        var okResult = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PaymentSettingsDto>().Subject;
        dto.BankTransferIban.Should().Be("PT50000201231234567890154");

        encryption.Verify(e => e.Decrypt("enc-iban"), Times.Once);
    }

    [Fact]
    public async Task Update_ShouldEncryptBankTransferIbanAndCardSecretKey_WhenProvided()
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
        };

        repository
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<PaymentSettings, bool>>>() ))
            .ReturnsAsync(new List<PaymentSettings> { existing });
        repository.Setup(r => r.Update(It.IsAny<PaymentSettings>()));
        repository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryption.Setup(e => e.Encrypt("PT50000201231234567890154")).Returns("enc-iban");
        encryption.Setup(e => e.Encrypt("sk_test_secret")).Returns("enc-secret");

        var controller = new PaymentSettingsController(repository.Object, encryption.Object);

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

        var actionResult = await controller.Update(condominiumId, request);

        actionResult.Should().BeOfType<OkObjectResult>();
        existing.BankTransferIbanEncrypted.Should().Be("enc-iban");
        existing.CardSecretKeyEncrypted.Should().Be("enc-secret");
        existing.CardSecretKey.Should().BeNull();

        encryption.Verify(e => e.Encrypt("PT50000201231234567890154"), Times.Once);
        encryption.Verify(e => e.Encrypt("sk_test_secret"), Times.Once);
    }
}

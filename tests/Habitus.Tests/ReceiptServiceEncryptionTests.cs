using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class ReceiptServiceEncryptionTests
{
    [Fact]
    public async Task GenerateReceiptPdfAsync_ShouldDecryptCondominiumTaxId_WhenTemplateTaxIdMissing()
    {
        var paymentRepository = new Mock<IRepository<Payment>>();
        var userRepository = new Mock<IRepository<User>>();
        var unitRepository = new Mock<IRepository<Unit>>();
        var condominiumRepository = new Mock<IRepository<Condominium>>();
        var receiptTemplateRepository = new Mock<IRepository<ReceiptTemplateSettings>>();
        var encryptionService = new Mock<IEncryptionService>();

        var paymentId = Guid.NewGuid();
        var residentId = Guid.NewGuid();
        var issuedByUserId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();

        var payment = new Payment
        {
            Id = paymentId,
            ResidentId = residentId,
            UnitId = unitId,
            CondominiumId = condominiumId,
            Type = PaymentType.MonthlyFee,
            Method = PaymentMethod.BankTransfer,
            Amount = 100m,
            Description = "Quota",
            Status = PaymentStatus.Approved,
            CreatedDate = DateTime.UtcNow,
        };

        paymentRepository.Setup(r => r.GetByIdAsync(paymentId)).ReturnsAsync(payment);
        paymentRepository
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Payment, bool>>>() ))
            .ReturnsAsync(new List<Payment>());
        paymentRepository.Setup(r => r.Update(It.IsAny<Payment>()));
        paymentRepository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        userRepository.Setup(r => r.GetByIdAsync(residentId)).ReturnsAsync(new User
        {
            Id = residentId,
            Name = "Resident A",
            Email = "resident@example.com",
            Role = UserRole.Resident,
            IsActive = true,
        });

        userRepository.Setup(r => r.GetByIdAsync(issuedByUserId)).ReturnsAsync(new User
        {
            Id = issuedByUserId,
            Name = "Admin A",
            Email = "admin@example.com",
            Role = UserRole.Admin,
            IsActive = true,
        });

        unitRepository.Setup(r => r.GetByIdAsync(unitId)).ReturnsAsync(new Unit
        {
            Id = unitId,
            CondominiumId = condominiumId,
            Number = "A1",
            Floor = 1,
            Type = UnitType.Apartment,
            MonthlyQuota = 100m,
        });

        condominiumRepository.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(new Condominium
        {
            Id = condominiumId,
            Name = "Condo A",
            Address = "Street 1",
            TaxIdEncrypted = "enc-taxid",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });

        receiptTemplateRepository
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ReceiptTemplateSettings, bool>>>() ))
            .ReturnsAsync(new List<ReceiptTemplateSettings>
            {
                new()
                {
                    CondominiumId = condominiumId,
                    CompanyName = "Condo A",
                    Address = "Street 1",
                    TaxId = null,
                }
            });

        encryptionService.Setup(e => e.Decrypt("enc-taxid")).Returns("123456789");

        var service = new ReceiptService(
            paymentRepository.Object,
            userRepository.Object,
            unitRepository.Object,
            condominiumRepository.Object,
            receiptTemplateRepository.Object,
            encryptionService.Object);

        var receiptPath = await service.GenerateReceiptPdfAsync(paymentId, issuedByUserId);

        receiptPath.Should().StartWith("/receipts/");
        encryptionService.Verify(e => e.Decrypt("enc-taxid"), Times.Once);

        CleanupGeneratedReceipt(receiptPath);
    }

    [Fact]
    public async Task GenerateReceiptPdfAsync_ShouldNotDecryptCondominiumTaxId_WhenTemplateTaxIdExists()
    {
        var paymentRepository = new Mock<IRepository<Payment>>();
        var userRepository = new Mock<IRepository<User>>();
        var unitRepository = new Mock<IRepository<Unit>>();
        var condominiumRepository = new Mock<IRepository<Condominium>>();
        var receiptTemplateRepository = new Mock<IRepository<ReceiptTemplateSettings>>();
        var encryptionService = new Mock<IEncryptionService>();

        var paymentId = Guid.NewGuid();
        var residentId = Guid.NewGuid();
        var issuedByUserId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();

        var payment = new Payment
        {
            Id = paymentId,
            ResidentId = residentId,
            UnitId = unitId,
            CondominiumId = condominiumId,
            Type = PaymentType.MonthlyFee,
            Method = PaymentMethod.BankTransfer,
            Amount = 100m,
            Description = "Quota",
            Status = PaymentStatus.Approved,
            CreatedDate = DateTime.UtcNow,
        };

        paymentRepository.Setup(r => r.GetByIdAsync(paymentId)).ReturnsAsync(payment);
        paymentRepository
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Payment, bool>>>() ))
            .ReturnsAsync(new List<Payment>());
        paymentRepository.Setup(r => r.Update(It.IsAny<Payment>()));
        paymentRepository.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        userRepository.Setup(r => r.GetByIdAsync(residentId)).ReturnsAsync(new User
        {
            Id = residentId,
            Name = "Resident A",
            Email = "resident@example.com",
            Role = UserRole.Resident,
            IsActive = true,
        });

        userRepository.Setup(r => r.GetByIdAsync(issuedByUserId)).ReturnsAsync(new User
        {
            Id = issuedByUserId,
            Name = "Admin A",
            Email = "admin@example.com",
            Role = UserRole.Admin,
            IsActive = true,
        });

        unitRepository.Setup(r => r.GetByIdAsync(unitId)).ReturnsAsync(new Unit
        {
            Id = unitId,
            CondominiumId = condominiumId,
            Number = "A1",
            Floor = 1,
            Type = UnitType.Apartment,
            MonthlyQuota = 100m,
        });

        condominiumRepository.Setup(r => r.GetByIdAsync(condominiumId)).ReturnsAsync(new Condominium
        {
            Id = condominiumId,
            Name = "Condo A",
            Address = "Street 1",
            TaxIdEncrypted = "enc-taxid",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });

        receiptTemplateRepository
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ReceiptTemplateSettings, bool>>>() ))
            .ReturnsAsync(new List<ReceiptTemplateSettings>
            {
                new()
                {
                    CondominiumId = condominiumId,
                    CompanyName = "Condo A",
                    Address = "Street 1",
                    TaxId = "999999990",
                }
            });

        var service = new ReceiptService(
            paymentRepository.Object,
            userRepository.Object,
            unitRepository.Object,
            condominiumRepository.Object,
            receiptTemplateRepository.Object,
            encryptionService.Object);

        var receiptPath = await service.GenerateReceiptPdfAsync(paymentId, issuedByUserId);

        receiptPath.Should().StartWith("/receipts/");
        encryptionService.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);

        CleanupGeneratedReceipt(receiptPath);
    }

    private static void CleanupGeneratedReceipt(string receiptPath)
    {
        var relativePath = receiptPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(Directory.GetCurrentDirectory(), relativePath);

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }
}

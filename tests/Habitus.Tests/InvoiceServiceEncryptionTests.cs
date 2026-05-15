using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace Habitus.Tests;

public class InvoiceServiceEncryptionTests
{
    [Fact]
    public async Task GetCondominiumInfoAsync_ShouldDecryptEncryptedTaxId()
    {
        var invoicesRepo = new Mock<IRepository<Invoice>>();
        var subscriptionsRepo = new Mock<IRepository<CondominiumSubscription>>();
        var condominiumsRepo = new Mock<IRepository<Condominium>>();
        var plansRepo = new Mock<IRepository<SubscriptionPlan>>();
        var documentsRepo = new Mock<IRepository<Document>>();
        var encryptionService = new Mock<IEncryptionService>();
        var blobStorage = new Mock<IBlobStorageService>();
        var emailService = new Mock<IEmailService>();

        var condoId = Guid.NewGuid();
        condominiumsRepo
            .Setup(r => r.GetByIdAsync(condoId))
            .ReturnsAsync(new Condominium
            {
                Id = condoId,
                Name = "Condo A",
                Address = "Street 1",
                Email = "condo@example.com",
                TaxIdEncrypted = "enc-taxid",
            });

        encryptionService.Setup(e => e.Decrypt("enc-taxid")).Returns("123456789");

        var service = CreateService(
            invoicesRepo,
            subscriptionsRepo,
            condominiumsRepo,
            plansRepo,
            documentsRepo,
            encryptionService,
            blobStorage,
            emailService);

        var result = await service.GetCondominiumInfoAsync(condoId);

        result.Should().NotBeNull();
        result!.TaxId.Should().Be("123456789");
        encryptionService.Verify(e => e.Decrypt("enc-taxid"), Times.Once);
    }

    [Fact]
    public async Task GetCondominiumInfoAsync_ShouldNotDecrypt_WhenEncryptedTaxIdIsMissing()
    {
        var invoicesRepo = new Mock<IRepository<Invoice>>();
        var subscriptionsRepo = new Mock<IRepository<CondominiumSubscription>>();
        var condominiumsRepo = new Mock<IRepository<Condominium>>();
        var plansRepo = new Mock<IRepository<SubscriptionPlan>>();
        var documentsRepo = new Mock<IRepository<Document>>();
        var encryptionService = new Mock<IEncryptionService>();
        var blobStorage = new Mock<IBlobStorageService>();
        var emailService = new Mock<IEmailService>();

        var condoId = Guid.NewGuid();
        condominiumsRepo
            .Setup(r => r.GetByIdAsync(condoId))
            .ReturnsAsync(new Condominium
            {
                Id = condoId,
                Name = "Condo A",
                Address = "Street 1",
                Email = "condo@example.com",
                TaxId = "123456789",
                TaxIdEncrypted = null,
            });

        var service = CreateService(
            invoicesRepo,
            subscriptionsRepo,
            condominiumsRepo,
            plansRepo,
            documentsRepo,
            encryptionService,
            blobStorage,
            emailService);

        var result = await service.GetCondominiumInfoAsync(condoId);

        result.Should().NotBeNull();
        result!.TaxId.Should().Be("123456789");
        encryptionService.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ExportSaftInvoicesAsync_ShouldReturnDecryptedCustomerTaxId()
    {
        var invoicesRepo = new Mock<IRepository<Invoice>>();
        var subscriptionsRepo = new Mock<IRepository<CondominiumSubscription>>();
        var condominiumsRepo = new Mock<IRepository<Condominium>>();
        var plansRepo = new Mock<IRepository<SubscriptionPlan>>();
        var documentsRepo = new Mock<IRepository<Document>>();
        var encryptionService = new Mock<IEncryptionService>();
        var blobStorage = new Mock<IBlobStorageService>();
        var emailService = new Mock<IEmailService>();

        var condominiumId = Guid.NewGuid();
        invoicesRepo
            .Setup(r => r.FindWithIncludesAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync(new List<Invoice>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    CondominiumId = condominiumId,
                    CustomerName = "Condo A",
                    CustomerAddress = "Street 1",
                    CustomerTaxIdEncrypted = "enc-taxid",
                    Series = "HABITUS",
                    Number = 1,
                    Year = 2026,
                    Type = InvoiceType.FT,
                    IssuedDate = DateTime.UtcNow,
                    DueDate = DateTime.UtcNow.AddDays(30),
                    PeriodStartDate = DateTime.UtcNow.Date,
                    PeriodEndDate = DateTime.UtcNow.Date.AddMonths(1).AddDays(-1),
                    SubtotalAmount = 100m,
                    VatAmount = 23m,
                    TotalAmount = 123m,
                    VatRate = 0.23m,
                    Status = InvoiceStatus.Emitted,
                    PlanName = "Starter",
                }
            });

        encryptionService.Setup(e => e.Decrypt("enc-taxid")).Returns("123456789");

        var service = CreateService(
            invoicesRepo,
            subscriptionsRepo,
            condominiumsRepo,
            plansRepo,
            documentsRepo,
            encryptionService,
            blobStorage,
            emailService);

        var result = await service.ExportSaftInvoicesAsync(condominiumId, 2026);

        result.Should().HaveCount(1);
        result[0].CustomerTaxId.Should().Be("123456789");
        encryptionService.Verify(e => e.Decrypt("enc-taxid"), Times.Once);
    }

    [Fact]
    public async Task GetCondominiumInvoicesAsync_ShouldMaskDecryptedCustomerTaxId()
    {
        var invoicesRepo = new Mock<IRepository<Invoice>>();
        var subscriptionsRepo = new Mock<IRepository<CondominiumSubscription>>();
        var condominiumsRepo = new Mock<IRepository<Condominium>>();
        var plansRepo = new Mock<IRepository<SubscriptionPlan>>();
        var documentsRepo = new Mock<IRepository<Document>>();
        var encryptionService = new Mock<IEncryptionService>();
        var blobStorage = new Mock<IBlobStorageService>();
        var emailService = new Mock<IEmailService>();

        var condominiumId = Guid.NewGuid();
        invoicesRepo
            .Setup(r => r.FindWithIncludesAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync(new List<Invoice>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    CondominiumId = condominiumId,
                    CustomerName = "Condo A",
                    CustomerAddress = "Street 1",
                    CustomerTaxIdEncrypted = "enc-taxid",
                    Series = "HABITUS",
                    Number = 7,
                    Year = 2026,
                    Type = InvoiceType.FT,
                    IssuedDate = DateTime.UtcNow,
                    DueDate = DateTime.UtcNow.AddDays(30),
                    PeriodStartDate = DateTime.UtcNow.Date,
                    PeriodEndDate = DateTime.UtcNow.Date.AddMonths(1).AddDays(-1),
                    SubtotalAmount = 100m,
                    VatAmount = 23m,
                    TotalAmount = 123m,
                    VatRate = 0.23m,
                    Status = InvoiceStatus.Emitted,
                    PlanName = "Starter",
                }
            });

        encryptionService.Setup(e => e.Decrypt("enc-taxid")).Returns("123456789");

        var service = CreateService(
            invoicesRepo,
            subscriptionsRepo,
            condominiumsRepo,
            plansRepo,
            documentsRepo,
            encryptionService,
            blobStorage,
            emailService);

        var result = await service.GetCondominiumInvoicesAsync(condominiumId);

        result.Should().HaveCount(1);
        result[0].CustomerTaxId.Should().Be("*****6789");
        encryptionService.Verify(e => e.Decrypt("enc-taxid"), Times.Once);
    }

    [Fact]
    public async Task GetCondominiumInvoicesAsync_ShouldNotDecrypt_WhenEncryptedTaxIdIsMissing()
    {
        var invoicesRepo = new Mock<IRepository<Invoice>>();
        var subscriptionsRepo = new Mock<IRepository<CondominiumSubscription>>();
        var condominiumsRepo = new Mock<IRepository<Condominium>>();
        var plansRepo = new Mock<IRepository<SubscriptionPlan>>();
        var documentsRepo = new Mock<IRepository<Document>>();
        var encryptionService = new Mock<IEncryptionService>();
        var blobStorage = new Mock<IBlobStorageService>();
        var emailService = new Mock<IEmailService>();

        var condominiumId = Guid.NewGuid();
        invoicesRepo
            .Setup(r => r.FindWithIncludesAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync(new List<Invoice>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    CondominiumId = condominiumId,
                    CustomerName = "Condo A",
                    CustomerAddress = "Street 1",
                    CustomerTaxIdEncrypted = null,
                    Series = "HABITUS",
                    Number = 8,
                    Year = 2026,
                    Type = InvoiceType.FT,
                    IssuedDate = DateTime.UtcNow,
                    DueDate = DateTime.UtcNow.AddDays(30),
                    PeriodStartDate = DateTime.UtcNow.Date,
                    PeriodEndDate = DateTime.UtcNow.Date.AddMonths(1).AddDays(-1),
                    SubtotalAmount = 100m,
                    VatAmount = 23m,
                    TotalAmount = 123m,
                    VatRate = 0.23m,
                    Status = InvoiceStatus.Emitted,
                    PlanName = "Starter",
                }
            });

        var service = CreateService(
            invoicesRepo,
            subscriptionsRepo,
            condominiumsRepo,
            plansRepo,
            documentsRepo,
            encryptionService,
            blobStorage,
            emailService);

        var result = await service.GetCondominiumInvoicesAsync(condominiumId);

        result.Should().HaveCount(1);
        result[0].CustomerTaxId.Should().BeEmpty();
        encryptionService.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);
    }

    private static InvoiceService CreateService(
        Mock<IRepository<Invoice>> invoicesRepo,
        Mock<IRepository<CondominiumSubscription>> subscriptionsRepo,
        Mock<IRepository<Condominium>> condominiumsRepo,
        Mock<IRepository<SubscriptionPlan>> plansRepo,
        Mock<IRepository<Document>> documentsRepo,
        Mock<IEncryptionService> encryptionService,
        Mock<IBlobStorageService> blobStorage,
        Mock<IEmailService> emailService)
    {
        var configuration = new ConfigurationBuilder().Build();
        var logger = Mock.Of<ILogger<InvoiceService>>();
        var pdfService = new InvoicePdfService(encryptionService.Object);

        return new InvoiceService(
            invoicesRepo.Object,
            subscriptionsRepo.Object,
            condominiumsRepo.Object,
            plansRepo.Object,
            documentsRepo.Object,
            encryptionService.Object,
            blobStorage.Object,
            pdfService,
            emailService.Object,
            configuration,
            logger);
    }
}

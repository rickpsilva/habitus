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
                Address = string.Empty,
                AddressEncrypted = "enc-address",
                Email = "condo@example.com",
                TaxIdEncrypted = "enc-taxid",
            });

        encryptionService.Setup(e => e.Decrypt("enc-taxid")).Returns("123456789");
        encryptionService.Setup(e => e.Decrypt("enc-address")).Returns("Street 1");

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
        result.Address.Should().Be("Street 1");
        encryptionService.Verify(e => e.Decrypt("enc-taxid"), Times.Once);
        encryptionService.Verify(e => e.Decrypt("enc-address"), Times.Once);
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
                    CustomerAddress = null,
                    CustomerAddressEncrypted = "enc-customer-address",
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
    encryptionService.Setup(e => e.Decrypt("enc-customer-address")).Returns("Street 1");

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
        result[0].CustomerAddress.Should().Be("Street 1");
        encryptionService.Verify(e => e.Decrypt("enc-taxid"), Times.Once);
        encryptionService.Verify(e => e.Decrypt("enc-customer-address"), Times.Once);
    }

    [Fact]
    public async Task ExportSaftInvoicesAsync_ShouldNotDecrypt_WhenEncryptedCustomerTaxIdIsMissing()
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
                    Number = 2,
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

        var result = await service.ExportSaftInvoicesAsync(condominiumId, 2026);

        result.Should().HaveCount(1);
        result[0].CustomerTaxId.Should().BeEmpty();
        encryptionService.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);
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

    [Fact]
    public async Task GenerateInvoiceAsync_ShouldReuseEncryptedCondominiumTaxId_WhenAvailable()
    {
        var invoicesRepo = new Mock<IRepository<Invoice>>();
        var subscriptionsRepo = new Mock<IRepository<CondominiumSubscription>>();
        var condominiumsRepo = new Mock<IRepository<Condominium>>();
        var plansRepo = new Mock<IRepository<SubscriptionPlan>>();
        var documentsRepo = new Mock<IRepository<Document>>();
        var encryptionService = new Mock<IEncryptionService>();
        var blobStorage = new Mock<IBlobStorageService>();
        var emailService = new Mock<IEmailService>();

        var subscriptionId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();

        var subscription = new CondominiumSubscription
        {
            Id = subscriptionId,
            CondominiumId = condominiumId,
            BillingCycle = BillingCycle.Monthly,
            Status = SubscriptionStatus.Active,
            NextBillingDate = DateTime.UtcNow.Date.AddDays(1),
            Condominium = new Condominium
            {
                Id = condominiumId,
                Name = "Condo A",
                Address = "Street 1",
                TaxId = null,
                TaxIdEncrypted = "enc-existing-taxid",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            },
            Plan = new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Name = "Starter",
                PriceMonthly = 100m,
                PriceAnnual = 1000m,
                PriceQuinquennial = 4500m,
            }
        };

        subscriptionsRepo
            .Setup(r => r.GetByIdWithIncludesAsync(subscriptionId, It.IsAny<string[]>()))
            .ReturnsAsync(subscription);
        subscriptionsRepo.Setup(r => r.Update(It.IsAny<CondominiumSubscription>()));

        invoicesRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>() ))
            .ReturnsAsync(new List<Invoice>());

        Invoice? added = null;
        invoicesRepo
            .Setup(r => r.AddAsync(It.IsAny<Invoice>()))
            .Callback<Invoice>(i => added = i)
            .Returns(Task.CompletedTask);
        invoicesRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        blobStorage
            .Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), "application/pdf"))
            .ReturnsAsync("https://blob.local/invoice.pdf");

        emailService
            .Setup(e => e.SendAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<EmailSenderType>(),
                It.IsAny<Guid?>()))
            .Returns(Task.CompletedTask);

        encryptionService.Setup(e => e.Encrypt("Street 1")).Returns("enc-address");
        encryptionService.Setup(e => e.Decrypt("enc-address")).Returns("Street 1");
        encryptionService.Setup(e => e.Decrypt("enc-existing-taxid")).Returns("123456789");

        var service = CreateService(
            invoicesRepo,
            subscriptionsRepo,
            condominiumsRepo,
            plansRepo,
            documentsRepo,
            encryptionService,
            blobStorage,
            emailService);

        var result = await service.GenerateInvoiceAsync(subscriptionId);

        added.Should().NotBeNull();
        added!.CustomerTaxIdEncrypted.Should().Be("enc-existing-taxid");
        added!.CustomerAddressEncrypted.Should().Be("enc-address");
        result.CustomerAddress.Should().Be("Street 1");
        result.CustomerTaxId.Should().Be("*****6789");

        encryptionService.Verify(e => e.Encrypt("Street 1"), Times.Once);
        encryptionService.Verify(e => e.Encrypt(It.Is<string>(s => s != "Street 1")), Times.Never);
    }

    [Fact]
    public async Task GenerateInvoiceAsync_ShouldEncryptCondominiumTaxId_WhenOnlyPlaintextExists()
    {
        var invoicesRepo = new Mock<IRepository<Invoice>>();
        var subscriptionsRepo = new Mock<IRepository<CondominiumSubscription>>();
        var condominiumsRepo = new Mock<IRepository<Condominium>>();
        var plansRepo = new Mock<IRepository<SubscriptionPlan>>();
        var documentsRepo = new Mock<IRepository<Document>>();
        var encryptionService = new Mock<IEncryptionService>();
        var blobStorage = new Mock<IBlobStorageService>();
        var emailService = new Mock<IEmailService>();

        var subscriptionId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();

        var subscription = new CondominiumSubscription
        {
            Id = subscriptionId,
            CondominiumId = condominiumId,
            BillingCycle = BillingCycle.Monthly,
            Status = SubscriptionStatus.Active,
            NextBillingDate = DateTime.UtcNow.Date.AddDays(1),
            Condominium = new Condominium
            {
                Id = condominiumId,
                Name = "Condo B",
                Address = "Street 2",
                TaxId = "987654321",
                TaxIdEncrypted = null,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            },
            Plan = new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Name = "Starter",
                PriceMonthly = 100m,
                PriceAnnual = 1000m,
                PriceQuinquennial = 4500m,
            }
        };

        subscriptionsRepo
            .Setup(r => r.GetByIdWithIncludesAsync(subscriptionId, It.IsAny<string[]>()))
            .ReturnsAsync(subscription);
        subscriptionsRepo.Setup(r => r.Update(It.IsAny<CondominiumSubscription>()));

        invoicesRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>() ))
            .ReturnsAsync(new List<Invoice>());

        Invoice? added = null;
        invoicesRepo
            .Setup(r => r.AddAsync(It.IsAny<Invoice>()))
            .Callback<Invoice>(i => added = i)
            .Returns(Task.CompletedTask);
        invoicesRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        blobStorage
            .Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), "application/pdf"))
            .ReturnsAsync("https://blob.local/invoice.pdf");

        emailService
            .Setup(e => e.SendAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<EmailSenderType>(),
                It.IsAny<Guid?>()))
            .Returns(Task.CompletedTask);

        encryptionService.Setup(e => e.Encrypt("987654321")).Returns("enc-new-taxid");
        encryptionService.Setup(e => e.Encrypt("Street 2")).Returns("enc-new-address");
        encryptionService.Setup(e => e.Decrypt("enc-new-taxid")).Returns("987654321");
        encryptionService.Setup(e => e.Decrypt("enc-new-address")).Returns("Street 2");

        var service = CreateService(
            invoicesRepo,
            subscriptionsRepo,
            condominiumsRepo,
            plansRepo,
            documentsRepo,
            encryptionService,
            blobStorage,
            emailService);

        var result = await service.GenerateInvoiceAsync(subscriptionId);

        added.Should().NotBeNull();
        added!.CustomerTaxIdEncrypted.Should().Be("enc-new-taxid");
        added!.CustomerAddress.Should().BeNull();
        added!.CustomerAddressEncrypted.Should().Be("enc-new-address");
        result.CustomerAddress.Should().Be("Street 2");
        result.CustomerTaxId.Should().Be("*****4321");

        encryptionService.Verify(e => e.Encrypt("987654321"), Times.Once);
        encryptionService.Verify(e => e.Encrypt("Street 2"), Times.Once);
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

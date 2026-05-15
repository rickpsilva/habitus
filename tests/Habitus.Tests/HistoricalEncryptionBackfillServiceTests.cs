using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace Habitus.Tests;

public class HistoricalEncryptionBackfillServiceTests
{
    [Fact]
    public async Task RunAsync_ShouldEncryptAndClearCondominiumLegacyFields()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var invoiceRepo = new Mock<IRepository<Invoice>>();
        var encryptionService = new Mock<IEncryptionService>();

        var condo = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = "Condo",
            Address = "Street 1",
            TaxId = "123456789",
            PaymentIban = "PT50000201231234567890154"
        };

        condominiumRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Condominium, bool>>>() ))
            .ReturnsAsync(new List<Condominium> { condo });
        condominiumRepo.Setup(r => r.Update(It.IsAny<Condominium>()));
        condominiumRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        invoiceRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>() ))
            .ReturnsAsync(new List<Invoice>());

        encryptionService.Setup(e => e.Encrypt("123456789")).Returns("enc-taxid");
        encryptionService.Setup(e => e.Encrypt("PT50000201231234567890154")).Returns("enc-iban");
        encryptionService.Setup(e => e.Encrypt("Street 1")).Returns("enc-address");

        var logger = Mock.Of<ILogger<HistoricalEncryptionBackfillService>>();
        var service = new HistoricalEncryptionBackfillService(
            condominiumRepo.Object,
            invoiceRepo.Object,
            encryptionService.Object,
            logger);

        var result = await service.RunAsync();

        condo.TaxIdEncrypted.Should().Be("enc-taxid");
        condo.TaxId.Should().BeNull();
        condo.PaymentIbanEncrypted.Should().Be("enc-iban");
        condo.PaymentIban.Should().BeNull();
        condo.AddressEncrypted.Should().Be("enc-address");
        condo.Address.Should().BeEmpty();

        result.CondominiumRecordsUpdated.Should().Be(1);
        result.InvoiceRecordsUpdated.Should().Be(0);
        result.ValuesEncrypted.Should().Be(3);
        result.LegacyValuesCleared.Should().Be(3);
    }

    [Fact]
    public async Task RunAsync_ShouldEncryptAndClearInvoiceLegacyFields()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var invoiceRepo = new Mock<IRepository<Invoice>>();
        var encryptionService = new Mock<IEncryptionService>();

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Year = 2026,
            Series = "HABITUS",
            CustomerName = "Condo",
            PlanName = "Starter",
            SubscriptionId = Guid.NewGuid(),
            CondominiumId = Guid.NewGuid(),
            IssuedDate = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(30),
            PeriodStartDate = DateTime.UtcNow,
            PeriodEndDate = DateTime.UtcNow,
            SubtotalAmount = 1m,
            VatAmount = 0.23m,
            TotalAmount = 1.23m,
            CustomerTaxId = "987654321",
            CustomerAddress = "Street 2"
        };

        condominiumRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Condominium, bool>>>() ))
            .ReturnsAsync(new List<Condominium>());

        invoiceRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>() ))
            .ReturnsAsync(new List<Invoice> { invoice });
        invoiceRepo.Setup(r => r.Update(It.IsAny<Invoice>()));
        invoiceRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        encryptionService.Setup(e => e.Encrypt("987654321")).Returns("enc-customer-taxid");
        encryptionService.Setup(e => e.Encrypt("Street 2")).Returns("enc-customer-address");

        var logger = Mock.Of<ILogger<HistoricalEncryptionBackfillService>>();
        var service = new HistoricalEncryptionBackfillService(
            condominiumRepo.Object,
            invoiceRepo.Object,
            encryptionService.Object,
            logger);

        var result = await service.RunAsync();

        invoice.CustomerTaxIdEncrypted.Should().Be("enc-customer-taxid");
        invoice.CustomerTaxId.Should().BeNull();
        invoice.CustomerAddressEncrypted.Should().Be("enc-customer-address");
        invoice.CustomerAddress.Should().BeNull();

        result.CondominiumRecordsUpdated.Should().Be(0);
        result.InvoiceRecordsUpdated.Should().Be(1);
        result.ValuesEncrypted.Should().Be(2);
        result.LegacyValuesCleared.Should().Be(2);
    }

    [Fact]
    public async Task RunAsync_ShouldOnlyClearLegacy_WhenEncryptedValuesAlreadyExist()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var invoiceRepo = new Mock<IRepository<Invoice>>();
        var encryptionService = new Mock<IEncryptionService>();

        var condo = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = "Condo",
            Address = "legacy-address",
            AddressEncrypted = "enc-address",
            TaxId = "legacy-taxid",
            TaxIdEncrypted = "enc-taxid",
            PaymentIban = "legacy-iban",
            PaymentIbanEncrypted = "enc-iban"
        };

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Year = 2026,
            Series = "HABITUS",
            CustomerName = "Condo",
            PlanName = "Starter",
            SubscriptionId = Guid.NewGuid(),
            CondominiumId = Guid.NewGuid(),
            IssuedDate = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(30),
            PeriodStartDate = DateTime.UtcNow,
            PeriodEndDate = DateTime.UtcNow,
            SubtotalAmount = 1m,
            VatAmount = 0.23m,
            TotalAmount = 1.23m,
            CustomerTaxId = "legacy-taxid",
            CustomerTaxIdEncrypted = "enc-taxid",
            CustomerAddress = "legacy-address",
            CustomerAddressEncrypted = "enc-address"
        };

        condominiumRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Condominium, bool>>>() ))
            .ReturnsAsync(new List<Condominium> { condo });
        condominiumRepo.Setup(r => r.Update(It.IsAny<Condominium>()));
        condominiumRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        invoiceRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>() ))
            .ReturnsAsync(new List<Invoice> { invoice });
        invoiceRepo.Setup(r => r.Update(It.IsAny<Invoice>()));
        invoiceRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var logger = Mock.Of<ILogger<HistoricalEncryptionBackfillService>>();
        var service = new HistoricalEncryptionBackfillService(
            condominiumRepo.Object,
            invoiceRepo.Object,
            encryptionService.Object,
            logger);

        var result = await service.RunAsync();

        condo.TaxId.Should().BeNull();
        condo.PaymentIban.Should().BeNull();
        condo.Address.Should().BeEmpty();
        invoice.CustomerTaxId.Should().BeNull();
        invoice.CustomerAddress.Should().BeNull();

        result.ValuesEncrypted.Should().Be(0);
        result.LegacyValuesCleared.Should().Be(5);
        result.CondominiumRecordsUpdated.Should().Be(1);
        result.InvoiceRecordsUpdated.Should().Be(1);

        encryptionService.Verify(e => e.Encrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task AuditRemainingLegacyPlaintextAsync_ShouldReturnCountsPerField()
    {
        var condominiumRepo = new Mock<IRepository<Condominium>>();
        var invoiceRepo = new Mock<IRepository<Invoice>>();
        var encryptionService = new Mock<IEncryptionService>();

        condominiumRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Condominium, bool>>>() ))
            .ReturnsAsync(new List<Condominium>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Name = "Condo A",
                    Address = "Street 1",
                    TaxId = "123",
                    PaymentIban = null
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    Name = "Condo B",
                    Address = string.Empty,
                    TaxId = null,
                    PaymentIban = "PT50"
                }
            });

        invoiceRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>() ))
            .ReturnsAsync(new List<Invoice>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Number = 1,
                    Year = 2026,
                    Series = "HABITUS",
                    CustomerName = "Condo",
                    PlanName = "Starter",
                    SubscriptionId = Guid.NewGuid(),
                    CondominiumId = Guid.NewGuid(),
                    IssuedDate = DateTime.UtcNow,
                    DueDate = DateTime.UtcNow.AddDays(30),
                    PeriodStartDate = DateTime.UtcNow,
                    PeriodEndDate = DateTime.UtcNow,
                    SubtotalAmount = 1m,
                    VatAmount = 0.23m,
                    TotalAmount = 1.23m,
                    CustomerTaxId = "987",
                    CustomerAddress = "Street 2"
                }
            });

        var logger = Mock.Of<ILogger<HistoricalEncryptionBackfillService>>();
        var service = new HistoricalEncryptionBackfillService(
            condominiumRepo.Object,
            invoiceRepo.Object,
            encryptionService.Object,
            logger);

        var audit = await service.AuditRemainingLegacyPlaintextAsync();

        audit.CondominiumTaxIdLegacyCount.Should().Be(1);
        audit.CondominiumPaymentIbanLegacyCount.Should().Be(1);
        audit.CondominiumAddressLegacyCount.Should().Be(1);
        audit.InvoiceCustomerTaxIdLegacyCount.Should().Be(1);
        audit.InvoiceCustomerAddressLegacyCount.Should().Be(1);
        audit.TotalRemaining.Should().Be(5);
    }
}

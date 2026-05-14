using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class InvoicePdfServiceEncryptionTests
{
    [Fact]
    public void GenerateInvoicePdf_ShouldDecryptCustomerTaxId_WhenEncryptedValueExists()
    {
        var encryption = new Mock<IEncryptionService>();
        encryption.Setup(e => e.Decrypt("enc-taxid")).Returns("123456789");

        var service = new InvoicePdfService(encryption.Object);
        var invoice = CreateBaseInvoice();
        invoice.CustomerTaxIdEncrypted = "enc-taxid";

        var result = service.GenerateInvoicePdf(invoice, "999999999");

        result.Should().NotBeNull();
        result.Should().NotBeEmpty();
        encryption.Verify(e => e.Decrypt("enc-taxid"), Times.Once);
    }

    [Fact]
    public void GenerateInvoicePdf_ShouldNotDecryptCustomerTaxId_WhenEncryptedValueIsMissing()
    {
        var encryption = new Mock<IEncryptionService>();
        var service = new InvoicePdfService(encryption.Object);

        var invoice = CreateBaseInvoice();
        invoice.CustomerTaxIdEncrypted = null;

        var result = service.GenerateInvoicePdf(invoice, "999999999");

        result.Should().NotBeNull();
        result.Should().NotBeEmpty();
        encryption.Verify(e => e.Decrypt(It.IsAny<string>()), Times.Never);
    }

    private static Invoice CreateBaseInvoice()
    {
        return new Invoice
        {
            Id = Guid.NewGuid(),
            CondominiumId = Guid.NewGuid(),
            SubscriptionId = Guid.NewGuid(),
            CustomerName = "Condo A",
            CustomerAddress = "Street 1",
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
            PlanName = "Starter"
        };
    }
}

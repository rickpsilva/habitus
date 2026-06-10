using System.IO;
using System.Text;
using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace Habitus.Tests;

public class InvoiceServiceDownloadTests
{
    [Fact]
    public async Task DownloadInvoicePdfAsync_ReturnsNull_WhenInvoiceNotFound()
    {
        var invoiceId = Guid.NewGuid();

        var invoicesRepo = new Mock<IRepository<Invoice>>();
        invoicesRepo.Setup(r => r.GetByIdAsync(invoiceId)).ReturnsAsync((Invoice?)null);

        var svc = new InvoiceService(
            invoicesRepo.Object,
            Mock.Of<IRepository<CondominiumSubscription>>(),
            Mock.Of<IRepository<Condominium>>(),
            Mock.Of<IRepository<SubscriptionPlan>>(),
            Mock.Of<IRepository<Document>>(),
            Mock.Of<IEncryptionService>(),
            Mock.Of<IBlobStorageService>(),
            new Mock<InvoicePdfService>(Mock.Of<IEncryptionService>()).Object,
            Mock.Of<IEmailService>(),
            Mock.Of<IConfiguration>(),
            Mock.Of<ILogger<InvoiceService>>());

        var result = await svc.DownloadInvoicePdfAsync(invoiceId);
        result.Should().BeNull();
    }

    [Fact]
    public async Task DownloadInvoicePdfAsync_ReturnsNull_WhenPdfPathEmpty()
    {
        var invoiceId = Guid.NewGuid();
        var invoice = new Invoice { Id = invoiceId, PdfPath = null, Year = 2026, Number = 1 };

        var invoicesRepo = new Mock<IRepository<Invoice>>();
        invoicesRepo.Setup(r => r.GetByIdAsync(invoiceId)).ReturnsAsync(invoice);

        var svc = new InvoiceService(
            invoicesRepo.Object,
            Mock.Of<IRepository<CondominiumSubscription>>(),
            Mock.Of<IRepository<Condominium>>(),
            Mock.Of<IRepository<SubscriptionPlan>>(),
            Mock.Of<IRepository<Document>>(),
            Mock.Of<IEncryptionService>(),
            Mock.Of<IBlobStorageService>(),
            new Mock<InvoicePdfService>(Mock.Of<IEncryptionService>()).Object,
            Mock.Of<IEmailService>(),
            Mock.Of<IConfiguration>(),
            Mock.Of<ILogger<InvoiceService>>());

        var result = await svc.DownloadInvoicePdfAsync(invoiceId);
        result.Should().BeNull();
    }

    [Fact]
    public async Task DownloadInvoicePdfAsync_ReturnsStream_WhenPdfPresent()
    {
        var invoiceId = Guid.NewGuid();
        var invoice = new Invoice
        {
            Id = invoiceId,
            PdfPath = "invoices/HABITUS-2026-000001.pdf",
            Year = 2026,
            Number = 1
        };

        var invoicesRepo = new Mock<IRepository<Invoice>>();
        invoicesRepo.Setup(r => r.GetByIdAsync(invoiceId)).ReturnsAsync(invoice);

        var pdfContent = Encoding.UTF8.GetBytes("PDF-DATA");
        var ms = new MemoryStream(pdfContent);

        var blobService = new Mock<IBlobStorageService>();
        blobService.Setup(b => b.DownloadAsync(invoice.PdfPath)).ReturnsAsync(((Stream)ms, "application/pdf"));

        var svc = new InvoiceService(
            invoicesRepo.Object,
            Mock.Of<IRepository<CondominiumSubscription>>(),
            Mock.Of<IRepository<Condominium>>(),
            Mock.Of<IRepository<SubscriptionPlan>>(),
            Mock.Of<IRepository<Document>>(),
            Mock.Of<IEncryptionService>(),
            blobService.Object,
            new Mock<InvoicePdfService>(Mock.Of<IEncryptionService>()).Object,
            Mock.Of<IEmailService>(),
            Mock.Of<IConfiguration>(),
            Mock.Of<ILogger<InvoiceService>>());

        var result = await svc.DownloadInvoicePdfAsync(invoiceId);

        result.Should().NotBeNull();
        result!.Value.ContentType.Should().Be("application/pdf");
        result.Value.FileName.Should().Be($"HABITUS-{invoice.Year}-{invoice.Number:D6}.pdf");

        // Verify stream content
        using var outMs = new MemoryStream();
        await result.Value.Stream.CopyToAsync(outMs);
        outMs.ToArray().Should().BeEquivalentTo(pdfContent);
    }
}

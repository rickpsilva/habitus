using System.Collections.Generic;
using System.Linq;
using FluentAssertions;
using Habitus.Application.DTOs.Billing;
using Habitus.Application.Services;
using Microsoft.Extensions.Configuration;

namespace Habitus.Tests;

public class SaftXmlServiceTests
{
    [Fact]
    public void GenerateSaftXml_WhenCalled_ReturnsWellFormedXmlWithInvoicesAndCustomers()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            { "Billing:CompanyNif", "123456789" },
            { "Billing:CompanyName", "HABITUS-TEST" }
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var svc = new SaftXmlService(config);

        var invoices = new List<SaftInvoiceDto>
        {
            new SaftInvoiceDto
            {
                Id = Guid.NewGuid(),
                InvoiceRef = "HABITUS-1/2026",
                IssuedDate = new DateTime(2026,1,15),
                CustomerName = "Cliente A",
                CustomerTaxId = "PT12345678",
                Description = "Plano Mensal",
                Quantity = 1,
                UnitPrice = 100m,
                NetAmount = 100m,
                VatAmount = 23m,
                GrossAmount = 123m,
                VatRate = 0.23m,
                Type = "FT",
                Status = "Emitted"
            },
            new SaftInvoiceDto
            {
                Id = Guid.NewGuid(),
                InvoiceRef = "HABITUS-2/2026",
                IssuedDate = new DateTime(2026,2,10),
                CustomerName = "Cliente B",
                CustomerTaxId = "PT87654321",
                Description = "Plano Anual",
                Quantity = 1,
                UnitPrice = 200m,
                NetAmount = 200m,
                VatAmount = 46m,
                GrossAmount = 246m,
                VatRate = 0.23m,
                Type = "FT",
                Status = "Emitted"
            }
        };

        var xml = svc.GenerateSaftXml(Guid.NewGuid(), "Condo Test", "PT99999999", "Rua Teste", 2026, invoices);

        xml.Should().NotBeNullOrWhiteSpace();
        xml.Should().Contain("<AuditFile");
        xml.Should().Contain("<Header");
        xml.Should().Contain("<MasterFiles");
        xml.Should().Contain("<SourceDocuments");
        xml.Should().Contain("<Customer");
        xml.Should().Contain("<Invoice");

        // Verify totals are reflected
        xml.Should().Contain("Total faturas");
    }
}

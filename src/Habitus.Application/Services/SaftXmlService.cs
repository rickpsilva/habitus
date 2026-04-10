using System.Text;
using System.Xml;
using Habitus.Application.DTOs.Billing;
using Microsoft.Extensions.Configuration;

namespace Habitus.Application.Services;

/// <summary>
/// Generates SAF-T (Standard Audit File for Tax) XML for Portugal.
/// Based on Portaria n.º 302/2016 – SAFT-PT schema v4.01.
/// </summary>
public class SaftXmlService
{
    private readonly IConfiguration _configuration;

    public SaftXmlService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    /// <summary>
    /// Generate a SAF-T PT XML document for all invoices in a given year.
    /// </summary>
    public string GenerateSaftXml(
        Guid condominiumId,
        string condominiumName,
        string? condominiumTaxId,
        string? condominiumAddress,
        int fiscalYear,
        IReadOnlyList<SaftInvoiceDto> invoices)
    {
        var companyNif     = _configuration["Billing:CompanyNif"] ?? "999999999";
        var companyName    = _configuration["Billing:CompanyName"] ?? "HABITUS";
        var now            = DateTime.UtcNow;
        var startDate      = new DateTime(fiscalYear, 1, 1);
        var endDate        = new DateTime(fiscalYear, 12, 31);

        var sb = new StringBuilder();
        var settings = new XmlWriterSettings
        {
            Indent = true,
            IndentChars = "  ",
            Encoding = Encoding.UTF8,
            OmitXmlDeclaration = false
        };

        using var writer = XmlWriter.Create(sb, settings);

        // Root element – SAF-T PT namespace
        writer.WriteStartDocument();
        writer.WriteStartElement("AuditFile", "urn:OECD:StandardAuditFile-Tax:PT_1.04_01");
        writer.WriteAttributeString("xmlns", "xsi", null, "http://www.w3.org/2001/XMLSchema-instance");

        WriteHeader(writer, companyNif, companyName, condominiumTaxId, condominiumName,
            condominiumAddress, fiscalYear, startDate, endDate, now, invoices.Count,
            invoices.Sum(i => i.GrossAmount));

        WriteMasterFiles(writer, invoices);

        WriteSourceDocuments(writer, invoices);

        writer.WriteEndElement(); // AuditFile
        writer.WriteEndDocument();
        writer.Flush();

        return sb.ToString();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Header
    // ─────────────────────────────────────────────────────────────────────────

    private static void WriteHeader(
        XmlWriter w,
        string companyNif,
        string companyName,
        string? condominiumTaxId,
        string condominiumName,
        string? condominiumAddress,
        int fiscalYear,
        DateTime startDate,
        DateTime endDate,
        DateTime createdAt,
        int invoiceCount,
        decimal totalDebit)
    {
        w.WriteStartElement("Header");

        w.WriteElementString("AuditFileVersion",    "1.04_01");
        w.WriteElementString("CompanyID",           condominiumTaxId ?? companyNif);
        w.WriteElementString("TaxRegistrationNumber", condominiumTaxId ?? companyNif);
        w.WriteElementString("TaxAccountingBasis",  "F"); // F = Facturação
        w.WriteElementString("CompanyName",         condominiumName);
        w.WriteElementString("BusinessName",        condominiumName);

        // CompanyAddress
        w.WriteStartElement("CompanyAddress");
        if (!string.IsNullOrEmpty(condominiumAddress))
        {
            w.WriteElementString("AddressDetail", condominiumAddress);
        }
        w.WriteElementString("City",       "Lisboa");
        w.WriteElementString("PostalCode", "0000-000");
        w.WriteElementString("Country",    "PT");
        w.WriteEndElement(); // CompanyAddress

        w.WriteElementString("FiscalYear",       fiscalYear.ToString());
        w.WriteElementString("StartDate",        startDate.ToString("yyyy-MM-dd"));
        w.WriteElementString("EndDate",          endDate.ToString("yyyy-MM-dd"));
        w.WriteElementString("CurrencyCode",     "EUR");
        w.WriteElementString("DateCreated",      createdAt.ToString("yyyy-MM-dd"));
        w.WriteElementString("TaxEntity",        "Global");
        w.WriteElementString("ProductCompanyTaxID", companyNif);
        w.WriteElementString("SoftwareCertificateNumber", "0");
        w.WriteElementString("ProductID",        "HABITUS/Habitus");
        w.WriteElementString("ProductVersion",   "1.0");

        // FileContentType summary
        w.WriteStartElement("HeaderComment");
        w.WriteString($"SAF-T gerado pela plataforma HABITUS em {createdAt:dd/MM/yyyy HH:mm}. Total faturas: {invoiceCount}.");
        w.WriteEndElement();

        w.WriteEndElement(); // Header
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MasterFiles – Customers table built from distinct invoice customers
    // ─────────────────────────────────────────────────────────────────────────

    private static void WriteMasterFiles(XmlWriter w, IReadOnlyList<SaftInvoiceDto> invoices)
    {
        w.WriteStartElement("MasterFiles");

        // GeneralLedgerAccounts – required by schema (empty section OK for billing-only export)
        w.WriteStartElement("GeneralLedgerAccounts");
        w.WriteEndElement();

        // Customers – one entry per unique CustomerTaxId
        var customers = invoices
            .Where(i => !string.IsNullOrEmpty(i.CustomerTaxId))
            .GroupBy(i => i.CustomerTaxId)
            .Select(g => g.First())
            .ToList();

        foreach (var c in customers)
        {
            w.WriteStartElement("Customer");
            w.WriteElementString("CustomerID",          c.CustomerTaxId!);
            w.WriteElementString("AccountID",           "CLIENTES");
            w.WriteElementString("CustomerTaxID",       c.CustomerTaxId!);
            w.WriteElementString("CompanyName",         c.CustomerName);

            // BillingAddress
            w.WriteStartElement("BillingAddress");
            if (!string.IsNullOrEmpty(c.CustomerAddress))
                w.WriteElementString("AddressDetail", c.CustomerAddress);
            w.WriteElementString("City",       "Lisboa");
            w.WriteElementString("PostalCode", "0000-000");
            w.WriteElementString("Country",    "PT");
            w.WriteEndElement(); // BillingAddress

            w.WriteElementString("SelfBillingIndicator", "0");
            w.WriteEndElement(); // Customer
        }

        // Tax Table
        w.WriteStartElement("TaxTable");
        w.WriteStartElement("TaxTableEntry");
        w.WriteElementString("TaxType",        "IVA");
        w.WriteElementString("TaxCountryRegion","PT");
        w.WriteElementString("TaxCode",        "NOR"); // Taxa Normal 23%
        w.WriteElementString("Description",    "IVA - Taxa Normal");
        w.WriteElementString("TaxPercentage",  "23");
        w.WriteEndElement(); // TaxTableEntry
        w.WriteEndElement(); // TaxTable

        w.WriteEndElement(); // MasterFiles
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SourceDocuments – SalesInvoices
    // ─────────────────────────────────────────────────────────────────────────

    private static void WriteSourceDocuments(XmlWriter w, IReadOnlyList<SaftInvoiceDto> invoices)
    {
        w.WriteStartElement("SourceDocuments");
        w.WriteStartElement("SalesInvoices");

        var totalDebit  = invoices.Sum(i => i.GrossAmount);
        var totalCredit = 0m;

        w.WriteElementString("NumberOfEntries", invoices.Count.ToString());
        w.WriteElementString("TotalDebit",      totalDebit.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
        w.WriteElementString("TotalCredit",     totalCredit.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));

        foreach (var inv in invoices)
        {
            WriteInvoice(w, inv);
        }

        w.WriteEndElement(); // SalesInvoices
        w.WriteEndElement(); // SourceDocuments
    }

    private static void WriteInvoice(XmlWriter w, SaftInvoiceDto inv)
    {
        w.WriteStartElement("Invoice");

        w.WriteElementString("InvoiceNo",   inv.InvoiceRef);
        w.WriteElementString("ATCUD",       "0"); // Requires AT registration; 0 = not registered

        // DocumentStatus
        w.WriteStartElement("DocumentStatus");
        w.WriteElementString("InvoiceStatus",         MapStatus(inv.Status));
        w.WriteElementString("InvoiceStatusDate",      inv.IssuedDate.ToString("yyyy-MM-ddTHH:mm:ss"));
        w.WriteElementString("SourceID",               "HABITUS");
        w.WriteElementString("SourceBilling",          "P"); // P = Programa
        w.WriteEndElement();

        w.WriteElementString("Hash",              "0"); // Not signing in this version
        w.WriteElementString("HashControl",       "1");
        w.WriteElementString("Period",             inv.IssuedDate.Month.ToString());
        w.WriteElementString("InvoiceDate",        inv.IssuedDate.ToString("yyyy-MM-dd"));
        w.WriteElementString("InvoiceType",        inv.Type); // FT or NC
        w.WriteElementString("SpecialRegimes",     "0"); // Regime normal
        w.WriteElementString("SourceID",           "HABITUS");
        w.WriteElementString("EACCode",            "6201"); // Actividades de programação informática
        w.WriteElementString("SystemEntryDate",    inv.IssuedDate.ToString("yyyy-MM-ddTHH:mm:ss"));
        w.WriteElementString("CustomerID",         inv.CustomerTaxId ?? "999999990"); // 999999990 = consumidor final

        // Line item
        w.WriteStartElement("Line");
        w.WriteElementString("LineNumber",          "1");

        // OrderReferences – optional but allowed
        w.WriteStartElement("References");
        w.WriteElementString("Description", inv.Description);
        w.WriteEndElement();

        w.WriteElementString("ProductCode",         "SUBSCRIPTION");
        w.WriteElementString("ProductDescription",  inv.Description);
        w.WriteElementString("Quantity",            inv.Quantity.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
        w.WriteElementString("UnitOfMeasure",       inv.UnitOfMeasure);
        w.WriteElementString("UnitPrice",           inv.UnitPrice.ToString("F4", System.Globalization.CultureInfo.InvariantCulture));
        w.WriteElementString("TaxPointDate",        inv.IssuedDate.ToString("yyyy-MM-dd"));
        w.WriteElementString("Description",         inv.Description);
        w.WriteElementString("CreditAmount",        inv.NetAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));

        // Tax detail on line
        w.WriteStartElement("Tax");
        w.WriteElementString("TaxType",         "IVA");
        w.WriteElementString("TaxCountryRegion","PT");
        w.WriteElementString("TaxCode",         "NOR");
        w.WriteElementString("TaxPercentage",   (inv.VatRate * 100m).ToString("F0"));
        w.WriteEndElement(); // Tax

        w.WriteElementString("TaxExemptionReason", string.Empty);
        w.WriteEndElement(); // Line

        // Document totals
        w.WriteStartElement("DocumentTotals");
        w.WriteElementString("TaxPayable",     inv.VatAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
        w.WriteElementString("NetTotal",       inv.NetAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
        w.WriteElementString("GrossTotal",     inv.GrossAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
        w.WriteEndElement(); // DocumentTotals

        w.WriteEndElement(); // Invoice
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static string MapStatus(string status) => status switch
    {
        "Paid"      => "N", // Normal (liquidada)
        "Emitted"   => "N",
        "Overdue"   => "N",
        "Cancelled" => "A", // Anulada
        "Draft"     => "N",
        _           => "N"
    };
}

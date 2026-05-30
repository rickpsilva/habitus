using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using System.Globalization;
using InvoiceEntity = Habitus.Domain.Entities.Invoice;

namespace Habitus.Application.Services;

/// <summary>
/// Service for generating invoice PDFs using QuestPdf.
/// Produces professional, SAF-T compliant invoices.
/// </summary>
public class InvoicePdfService
{
    private readonly CultureInfo _ptPt = CultureInfo.GetCultureInfo("pt-PT");
    private readonly IEncryptionService _encryptionService;

    public InvoicePdfService(IEncryptionService encryptionService)
    {
        // QuestPdf license (Community use)
        QuestPDF.Settings.License = LicenseType.Community;
        _encryptionService = encryptionService;
    }

    /// <summary>
    /// Generate a PDF for an invoice.
    /// </summary>
    public byte[] GenerateInvoicePdf(InvoiceEntity invoice, string companyNif, string? companyLogo = null)
    {
        // Decrypt and mask customer tax ID
        var maskedTaxId = string.Empty;
        if (!string.IsNullOrEmpty(invoice.CustomerTaxIdEncrypted))
        {
            var decryptedTaxId = _encryptionService.Decrypt(invoice.CustomerTaxIdEncrypted);
            maskedTaxId = MaskTaxId(decryptedTaxId);
        }

        return QuestPDF.Fluent.Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(25);

                page.Header().ShowOnce().Element(headerContainer =>
                {
                    headerContainer.Column(col =>
                    {
                        // Company header
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("HABITUS").FontSize(22).Bold();
                                c.Item().Text("Plataforma de Gestão de Condomínios").FontSize(9);
                            });

                            row.RelativeItem().Column(c =>
                            {
                                c.Item().AlignRight().Text($"FATURA {invoice.Series}-{invoice.Number}/{invoice.Year}").FontSize(12).Bold();
                                c.Item().AlignRight().PaddingTop(5).Text($"Emissão: {invoice.IssuedDate:dd/MM/yyyy}").FontSize(9);
                                c.Item().AlignRight().Text($"Vencimento: {invoice.DueDate:dd/MM/yyyy}").FontSize(9);
                            });
                        });

                        col.Item().PaddingVertical(10).Text("─────────────────────────────────────────────────────────").FontSize(8);
                    });
                });

                page.Content().Column(contentCol =>
                {
                    // Customer info
                    contentCol.Item().Column(col =>
                    {
                        col.Item().Text("CLIENTE").FontSize(10).Bold();
                        col.Item().PaddingTop(3).Text($"Designação: {invoice.CustomerName}").FontSize(9);
                        if (!string.IsNullOrEmpty(maskedTaxId))
                            col.Item().Text($"NIF: {maskedTaxId}").FontSize(9);
                        if (!string.IsNullOrEmpty(invoice.CustomerAddress))
                            col.Item().Text($"Morada: {invoice.CustomerAddress}").FontSize(9);
                    });

                    contentCol.Item().PaddingVertical(10).Text("─────────────────────────────────────────────────────────").FontSize(8);

                    // Service info
                    contentCol.Item().Column(col =>
                    {
                        col.Item().Text("SERVIÇO").FontSize(10).Bold();
                        col.Item().PaddingTop(3).Text($"Plano: {invoice.PlanName}").FontSize(9);
                        col.Item().Text($"Período: {invoice.PeriodStartDate:dd/MM/yyyy} a {invoice.PeriodEndDate:dd/MM/yyyy}").FontSize(9);
                    });

                    contentCol.Item().PaddingVertical(10).Text("─────────────────────────────────────────────────────────").FontSize(8);

                    // Invoice table
                    contentCol.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(2.5f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1f);
                        });

                        // Headers
                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(5).Text("Descrição").FontSize(9).Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(5).Text("Qtd.").FontSize(9).Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(5).Text("Preço Unit.").FontSize(9).Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(5).Text("Total").FontSize(9).Bold();
                        });

                        // Line item
                        table.Cell().Padding(5).Text($"Subscrição ao plano {invoice.PlanName}").FontSize(9);
                        table.Cell().Padding(5).Text("1").FontSize(9);
                        table.Cell().Padding(5).Text($"€ {invoice.SubtotalAmount:N2}").FontSize(9);
                        table.Cell().Padding(5).Text($"€ {invoice.SubtotalAmount:N2}").FontSize(9);
                    });

                    contentCol.Item().PaddingVertical(10).Text("─────────────────────────────────────────────────────────").FontSize(8);

                    // Totals
                    contentCol.Item().AlignRight().Column(col =>
                    {
                        col.Item().Text($"Subtotal (s/ IVA).......... € {invoice.SubtotalAmount:N2}").FontSize(9);
                        col.Item().Text($"IVA ({invoice.VatRate * 100:F0}%)............... € {invoice.VatAmount:N2}").FontSize(9);
                        col.Item().PaddingTop(5).Text($"TOTAL A PAGAR........... € {invoice.TotalAmount:N2}").FontSize(10).Bold();
                    });

                    contentCol.Item().PaddingVertical(10).Text("═════════════════════════════════════════════════════════").FontSize(8);

                    // Payment terms
                    contentCol.Item().Column(col =>
                    {
                        col.Item().Text("CONDIÇÕES DE PAGAMENTO").FontSize(9).Bold();
                        col.Item().PaddingTop(5).Text(
                            $"Data de vencimento: {invoice.DueDate:dd/MM/yyyy}\n" +
                            "Favor remeter o pagamento por transferência bancária.\n" +
                            "contacte-nos para confirmação de dados bancários."
                        ).FontSize(8).LineHeight(1.4f);
                    });

                    if (invoice.Status == InvoiceStatus.Paid)
                    {
                        contentCol.Item().PaddingTop(10).Text($"✓ FATURA PAGA em {invoice.PaidDate:dd/MM/yyyy}").FontSize(9).Bold();
                    }
                    else if (invoice.Status == InvoiceStatus.Cancelled)
                    {
                        contentCol.Item().PaddingTop(10).Text("✗ FATURA CANCELADA").FontSize(9).Bold();
                    }
                });

                page.Footer().AlignCenter().PaddingTop(10).Text(
                    $"NIF da Empresa: {companyNif} | Documento gerado by HABITUS em {DateTime.UtcNow:dd/MM/yyyy HH:mm}"
                ).FontSize(7);
            });
        }).GeneratePdf();
    }

    private string TranslateStatus(InvoiceStatus status)
    {
        return status switch
        {
            InvoiceStatus.Draft => "Rascunho",
            InvoiceStatus.Emitted => "Emitida",
            InvoiceStatus.Paid => "Paga",
            InvoiceStatus.Overdue => "Vencida",
            InvoiceStatus.Cancelled => "Cancelada",
            _ => status.ToString()
        };
    }

    private string MaskTaxId(string taxId)
    {
        if (string.IsNullOrEmpty(taxId) || taxId.Length < 4)
            return taxId;

        return new string('*', taxId.Length - 4) + taxId.Substring(taxId.Length - 4);
    }
}

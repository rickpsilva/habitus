using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using DomainUnit = Habitus.Domain.Entities.Unit;
using DomainDocument = Habitus.Domain.Entities.Document;

namespace Habitus.Application.Services;

public class ReceiptService
{
    private readonly IRepository<Payment> _paymentRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<DomainUnit> _unitRepository;
    private readonly IRepository<Condominium> _condominiumRepository;

    public ReceiptService(
        IRepository<Payment> paymentRepository,
        IRepository<User> userRepository,
        IRepository<DomainUnit> unitRepository,
        IRepository<Condominium> condominiumRepository)
    {
        _paymentRepository = paymentRepository;
        _userRepository = userRepository;
        _unitRepository = unitRepository;
        _condominiumRepository = condominiumRepository;
        
        // Configure QuestPDF license (Community license is free for open source)
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<string> GenerateReceiptPdfAsync(Guid paymentId, Guid issuedByUserId)
    {
        var payment = await _paymentRepository.GetByIdAsync(paymentId);
        if (payment == null)
            throw new InvalidOperationException("Payment not found");

        if (payment.Status != PaymentStatus.Approved)
            throw new InvalidOperationException("Only approved payments can have receipts issued");

        var resident = await _userRepository.GetByIdAsync(payment.ResidentId);
        var unit = await _unitRepository.GetByIdAsync(payment.UnitId);
        var condominium = await _condominiumRepository.GetByIdAsync(payment.CondominiumId);
        var issuedBy = await _userRepository.GetByIdAsync(issuedByUserId);

        if (resident == null || unit == null || condominium == null || issuedBy == null)
            throw new InvalidOperationException("Required entities not found");

        // Get next receipt number for this year
        var currentYear = DateTime.UtcNow.Year;
        var maxReceiptNumber = (await _paymentRepository.FindAsync(
            p => p.ReceiptYear == currentYear && p.ReceiptNumber.HasValue))
            .Max(p => p.ReceiptNumber) ?? 0;
        
        var receiptNumber = maxReceiptNumber + 1;

        // Update payment with receipt information
        payment.ReceiptNumber = receiptNumber;
        payment.ReceiptYear = currentYear;
        payment.ReceiptIssuedDate = DateTime.UtcNow;
        payment.ReceiptIssuedByUserId = issuedByUserId;

        // Generate PDF
        var pdfBytes = GenerateReceiptPdf(payment, resident, unit, condominium, issuedBy, receiptNumber, currentYear);

        // Save PDF to disk (in production, save to blob storage)
        var fileName = $"receipt_{receiptNumber}_{currentYear}_{payment.Id}.pdf";
        var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "receipts");
        Directory.CreateDirectory(uploadsPath);
        
        var filePath = Path.Combine(uploadsPath, fileName);
        await File.WriteAllBytesAsync(filePath, pdfBytes);

        payment.ReceiptPdfPath = $"/receipts/{fileName}";

        _paymentRepository.Update(payment);
        await _paymentRepository.SaveChangesAsync();

        return payment.ReceiptPdfPath;
    }

    private byte[] GenerateReceiptPdf(
        Payment payment,
        User resident,
        DomainUnit unit,
        Condominium condominium,
        User issuedBy,
        int receiptNumber,
        int receiptYear)
    {
        var document = QuestPDF.Fluent.Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily("Arial"));

                page.Content().Column(column =>
                {
                    column.Spacing(15);

                    // Header: Condominium Info
                    column.Item().Text(text =>
                    {
                        text.Span(condominium.Name.ToUpper()).Bold().FontSize(14);
                    });

                    column.Item().Text(condominium.Address).FontSize(10);
                    
                    if (!string.IsNullOrEmpty(condominium.TaxId))
                    {
                        column.Item().Text($"NIPC: {condominium.TaxId}").FontSize(10);
                    }

                    column.Item().PaddingTop(10);

                    // Receipt Number (right aligned)
                    column.Item().AlignRight().Text($"Nº {receiptNumber}/{receiptYear}").Bold().FontSize(12);

                    column.Item().PaddingTop(15);

                    // Title
                    column.Item().AlignCenter().Text("RECIBO DAS QUOTAS DO CONDOMÍNIO")
                        .Bold()
                        .FontSize(16);

                    column.Item().PaddingTop(20);

                    // Receipt Body
                    column.Item().PaddingVertical(5).Text(text =>
                    {
                        text.DefaultTextStyle(t => t.FontSize(11).LineHeight(1.5f));
                        text.Span("Recebemos do Sr. ");
                        text.Span(resident.Name).Bold();
                        text.Span(", proprietário da fração ");
                        text.Span(unit.Number).Bold();
                        text.Span($" - {unit.Floor}");
                        text.Span(", ");
                        text.Span(condominium.Name);
                        text.Span(", a quantia de ");
                        text.Span($"{payment.Amount:F2} euros").Bold();
                        text.Span(", valor destinado às quotas para comparticipação nas despesas de Condomínio e Fundo Comum de Reserva");
                        
                        // Add period information from description
                        if (!string.IsNullOrEmpty(payment.Description))
                        {
                            text.Span(" ");
                            text.Span(payment.Description.ToLower());
                        }
                        
                        text.Span(".");
                    });

                    column.Item().PaddingTop(30);

                    // Location and Date
                    var issueDate = payment.ReceiptIssuedDate ?? DateTime.UtcNow;
                    var monthName = GetPortugueseMonthName(issueDate.Month);
                    
                    column.Item().Text($"{GetIssuanceLocation(condominium.Address)}, {issueDate.Day} de {monthName} de {issueDate.Year},")
                        .FontSize(11);

                    column.Item().PaddingTop(40);

                    // Signature
                    column.Item().AlignRight().Column(signatureColumn =>
                    {
                        signatureColumn.Item().Text("A Administração").FontSize(11);
                        signatureColumn.Item().PaddingTop(5).Text(issuedBy.Name).Bold().FontSize(11);
                    });
                });

                // Footer
                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Documento gerado eletronicamente • ").FontSize(8).FontColor(Colors.Grey.Medium);
                    text.Span($"Emitido em {DateTime.UtcNow:dd/MM/yyyy HH:mm}").FontSize(8).FontColor(Colors.Grey.Medium);
                });
            });
        });

        return document.GeneratePdf();
    }

    private string GetPortugueseMonthName(int month)
    {
        return month switch
        {
            1 => "janeiro",
            2 => "fevereiro",
            3 => "março",
            4 => "abril",
            5 => "maio",
            6 => "junho",
            7 => "julho",
            8 => "agosto",
            9 => "setembro",
            10 => "outubro",
            11 => "novembro",
            12 => "dezembro",
            _ => ""
        };
    }

    private string GetIssuanceLocation(string address)
    {
        // Extract city from address (simple extraction, can be improved)
        var parts = address.Split(',');
        if (parts.Length > 1)
        {
            // Try to get city/location from last part
            var lastPart = parts[^1].Trim();
            // If it starts with a digit, it's likely a postal code, use second to last
            if (parts.Length > 2 && char.IsDigit(lastPart[0]))
            {
                return parts[^2].Trim();
            }
            return lastPart;
        }
        // Fallback
        return "Ermesinde";
    }
}

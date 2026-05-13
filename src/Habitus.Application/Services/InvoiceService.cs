using Habitus.Application.DTOs.Billing;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Habitus.Application.Services;

public class InvoiceService
{
    private readonly IRepository<Invoice> _invoicesRepo;
    private readonly IRepository<CondominiumSubscription> _subscriptionsRepo;
    private readonly IRepository<Condominium> _condominiumsRepo;
    private readonly IRepository<SubscriptionPlan> _plansRepo;
    private readonly IRepository<Document> _documentsRepo;
    private readonly IEncryptionService _encryptionService;
    private readonly IBlobStorageService _blobStorageService;
    private readonly InvoicePdfService _pdfService;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<InvoiceService> _logger;

    public InvoiceService(
        IRepository<Invoice> invoicesRepo,
        IRepository<CondominiumSubscription> subscriptionsRepo,
        IRepository<Condominium> condominiumsRepo,
        IRepository<SubscriptionPlan> plansRepo,
        IRepository<Document> documentsRepo,
        IEncryptionService encryptionService,
        IBlobStorageService blobStorageService,
        InvoicePdfService pdfService,
        IEmailService emailService,
        IConfiguration configuration,
        ILogger<InvoiceService> logger)
    {
        _invoicesRepo = invoicesRepo;
        _subscriptionsRepo = subscriptionsRepo;
        _condominiumsRepo = condominiumsRepo;
        _plansRepo = plansRepo;
        _documentsRepo = documentsRepo;
        _encryptionService = encryptionService;
        _blobStorageService = blobStorageService;
        _pdfService = pdfService;
        _emailService = emailService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Get basic condominium info needed for SAF-T header and PDF generation.
    /// </summary>
    public async Task<CondominiumInfoDto?> GetCondominiumInfoAsync(Guid condominiumId)
    {
        var condominium = await _condominiumsRepo.GetByIdAsync(condominiumId);
        if (condominium == null) return null;

        return new CondominiumInfoDto
        {
            Id      = condominium.Id,
            Name    = condominium.Name,
            Address = condominium.Address,
            Email   = condominium.Email,
            TaxId   = !string.IsNullOrEmpty(condominium.TaxIdEncrypted)
                        ? _encryptionService.Decrypt(condominium.TaxIdEncrypted)
                        : condominium.TaxId
        };
    }

    /// <summary>
    /// Get all invoices for a condominium.
    /// </summary>
    public async Task<List<InvoiceDto>> GetCondominiumInvoicesAsync(Guid condominiumId)
    {
        var invoices = await _invoicesRepo.FindWithIncludesAsync(
            i => i.CondominiumId == condominiumId,
            nameof(Invoice.Condominium),
            nameof(Invoice.Subscription),
            nameof(Invoice.Subscription) + "." + nameof(CondominiumSubscription.Plan)
        );

        return invoices
            .OrderByDescending(i => i.IssuedDate)
            .Select(MapInvoiceToDto)
            .ToList();
    }

    /// <summary>
    /// Get a specific invoice.
    /// </summary>
    public async Task<InvoiceDto?> GetInvoiceAsync(Guid invoiceId)
    {
        var invoice = await _invoicesRepo.GetByIdWithIncludesAsync(
            invoiceId,
            nameof(Invoice.Condominium),
            nameof(Invoice.Subscription),
            nameof(Invoice.Subscription) + "." + nameof(CondominiumSubscription.Plan)
        );

        return invoice == null ? null : MapInvoiceToDto(invoice);
    }

    /// <summary>
    /// Generate a new invoice for a subscription.
    /// This creates an invoice for the service period and updates the NextBillingDate.
    /// </summary>
    public async Task<InvoiceDto> GenerateInvoiceAsync(
        Guid subscriptionId,
        Guid? issuedByUserId = null)
    {
        var subscription = await _subscriptionsRepo.GetByIdWithIncludesAsync(
            subscriptionId,
            nameof(CondominiumSubscription.Condominium),
            nameof(CondominiumSubscription.Plan)
        ) ?? throw new InvalidOperationException("Subscription not found");

        if (subscription.Status != SubscriptionStatus.Active)
            throw new InvalidOperationException("Only active subscriptions can be invoiced");

        var condominium = subscription.Condominium;
        var plan = subscription.Plan;

        // Calculate billing period
        var now = DateTime.UtcNow;
        var periodStart = subscription.NextBillingDate.AddMonths(-1);
        var periodEnd = subscription.NextBillingDate.AddSeconds(-1);

        // Determine invoice price based on billing cycle
        var (serviceAmount, newNextBillingDate) = subscription.BillingCycle switch
        {
            BillingCycle.Monthly => (plan.PriceMonthly, subscription.NextBillingDate.AddMonths(1)),
            BillingCycle.Annual => (plan.PriceAnnual, subscription.NextBillingDate.AddYears(1)),
            BillingCycle.Quinquennial => (plan.PriceQuinquennial, subscription.NextBillingDate.AddYears(5)),
            _ => throw new InvalidOperationException("Unknown billing cycle")
        };

        // Calculate VAT (23% for Portugal)
        const decimal vatRate = 0.23m;
        var vatAmount = Math.Round(serviceAmount * vatRate, 2);
        var totalAmount = serviceAmount + vatAmount;

        // Get next invoice number for this condominium and year
        var invoiceNumber = await GetNextInvoiceNumberAsync(condominium.Id);

        // Encrypt the tax ID
        var encryptedTaxId = !string.IsNullOrEmpty(condominium.TaxId)
            ? _encryptionService.Encrypt(condominium.TaxId)
            : condominium.TaxId;

        // Create invoice
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            Number = invoiceNumber,
            Series = "HABITUS",
            Year = now.Year,
            Type = InvoiceType.FT, // Regular invoice
            IssuedDate = now,
            DueDate = now.AddDays(30), // 30 days payment term
            CondominiumId = condominium.Id,
            CustomerName = condominium.Name,
            CustomerTaxIdEncrypted = encryptedTaxId,
            CustomerAddress = condominium.Address,
            SubscriptionId = subscriptionId,
            PlanName = plan.Name,
            PeriodStartDate = periodStart,
            PeriodEndDate = periodEnd,
            SubtotalAmount = serviceAmount,
            VatAmount = vatAmount,
            TotalAmount = totalAmount,
            VatRate = vatRate,
            Status = InvoiceStatus.Emitted,
            IssuedByUserId = issuedByUserId,
            CreatedAt = now,
            CreatedByUserId = issuedByUserId
        };

        await _invoicesRepo.AddAsync(invoice);

        // Generate and store PDF in blob storage
        var companyNif = _configuration["Billing:CompanyNif"] ?? "999999999";
        var pdfUrl = await GenerateAndStorePdfAsync(invoice, companyNif);
        if (!string.IsNullOrEmpty(pdfUrl))
        {
            invoice.PdfPath = pdfUrl;
        }

        // Update subscription's NextBillingDate
        subscription.NextBillingDate = newNextBillingDate;
        subscription.UpdatedAt = now;
        _subscriptionsRepo.Update(subscription);

        await _invoicesRepo.SaveChangesAsync();

        // Send email notification (fire-and-forget: failure doesn't affect invoice)
        _ = SendInvoiceEmailAsync(invoice, condominium);

        return MapInvoiceToDto(invoice);
    }

    /// <summary>
    /// Mark an invoice as paid.
    /// </summary>
    public async Task<InvoiceDto> MarkInvoiceAsPaidAsync(
        Guid invoiceId,
        DateTime? paidDate = null,
        string? notes = null)
    {
        var invoice = await _invoicesRepo.GetByIdWithIncludesAsync(
            invoiceId,
            nameof(Invoice.Condominium),
            nameof(Invoice.Subscription),
            nameof(Invoice.Subscription) + "." + nameof(CondominiumSubscription.Plan)
        ) ?? throw new InvalidOperationException("Invoice not found");

        if (invoice.Status == InvoiceStatus.Cancelled)
            throw new InvalidOperationException("Cannot mark cancelled invoice as paid");

        invoice.PaidDate = paidDate ?? DateTime.UtcNow;
        invoice.Status = InvoiceStatus.Paid;
        if (!string.IsNullOrWhiteSpace(notes))
            invoice.Notes = notes;
        invoice.UpdatedAt = DateTime.UtcNow;

        _invoicesRepo.Update(invoice);
        await _invoicesRepo.SaveChangesAsync();

        return MapInvoiceToDto(invoice);
    }

    /// <summary>
    /// Cancel an invoice (for error corrections or plan cancellations).
    /// Optionally creates a credit note (cancellation invoice).
    /// </summary>
    public async Task<InvoiceDto> CancelInvoiceAsync(
        Guid invoiceId,
        string reason,
        string? notes = null)
    {
        var invoice = await _invoicesRepo.GetByIdWithIncludesAsync(
            invoiceId,
            nameof(Invoice.Condominium),
            nameof(Invoice.Subscription),
            nameof(Invoice.Subscription) + "." + nameof(CondominiumSubscription.Plan)
        ) ?? throw new InvalidOperationException("Invoice not found");

        if (invoice.Status == InvoiceStatus.Cancelled)
            throw new InvalidOperationException("Invoice already cancelled");

        invoice.Status = InvoiceStatus.Cancelled;
        invoice.CancellationReason = reason;
        invoice.Notes = notes;
        invoice.UpdatedAt = DateTime.UtcNow;

        _invoicesRepo.Update(invoice);
        await _invoicesRepo.SaveChangesAsync();

        return MapInvoiceToDto(invoice);
    }

    /// <summary>
    /// Auto-generate invoices for all subscriptions due today.
    /// Called by background job daily.
    /// </summary>
    public async Task<int> GenerateDueInvoicesAsync(Guid? userId = null)
    {
        var now = DateTime.UtcNow.Date;

        // Find subscriptions that are due for invoicing
        var dueSubscriptions = await _subscriptionsRepo.FindWithIncludesAsync(
            s => s.Status == SubscriptionStatus.Active && s.NextBillingDate.Date <= now,
            nameof(CondominiumSubscription.Condominium),
            nameof(CondominiumSubscription.Plan)
        );

        var generatedCount = 0;
        foreach (var subscription in dueSubscriptions)
        {
            try
            {
                await GenerateInvoiceAsync(subscription.Id, userId);
                generatedCount++;
            }
            catch (Exception ex)
            {
                // Log error and continue with next subscription
                // TODO: Add proper logging
                System.Diagnostics.Debug.WriteLine($"Error generating invoice for subscription {subscription.Id}: {ex.Message}");
            }
        }

        return generatedCount;
    }

    /// <summary>
    /// Get invoices with Overdue status update.
    /// (Status is not automatically updated, this helper refreshes them)
    /// </summary>
    public async Task<List<InvoiceDto>> GetCondominiumInvoicesWithStatusAsync(Guid condominiumId)
    {
        var invoices = await GetCondominiumInvoicesAsync(condominiumId);
        
        // Mark overdue invoices in memory (not persisted, for display only)
        var now = DateTime.UtcNow;
        foreach (var invoice in invoices)
        {
            if (invoice.Status == "Emitted" && now > invoice.DueDate)
            {
                // This is display-only; real status updates happen on mark-paid
                invoice.Status = "Overdue";
            }
        }

        return invoices;
    }

    /// <summary>
    /// Export invoices for SAF-T reporting.
    /// </summary>
    public async Task<List<SaftInvoiceDto>> ExportSaftInvoicesAsync(
        Guid condominiumId,
        int year)
    {
        var invoices = await _invoicesRepo.FindWithIncludesAsync(
            i => i.CondominiumId == condominiumId && i.Year == year,
            nameof(Invoice.Condominium),
            nameof(Invoice.Subscription),
            nameof(Invoice.Subscription) + "." + nameof(CondominiumSubscription.Plan)
        );

        return invoices
            .Where(i => i.Status != InvoiceStatus.Draft) // Only emitted invoices for SAF-T
            .Select(inv =>
            {
                var decryptedTaxId = string.Empty;
                if (!string.IsNullOrEmpty(inv.CustomerTaxIdEncrypted))
                {
                    decryptedTaxId = _encryptionService.Decrypt(inv.CustomerTaxIdEncrypted);
                }

                return new SaftInvoiceDto
                {
                    Id = inv.Id,
                    Type = inv.Type.ToString(),
                    InvoiceRef = $"{inv.Series}-{inv.Number}/{inv.Year}",
                    IssuedDate = inv.IssuedDate,
                    DueDate = inv.DueDate,
                    PaidDate = inv.PaidDate,
                    CustomerName = inv.CustomerName,
                    CustomerTaxId = decryptedTaxId,
                    CustomerAddress = inv.CustomerAddress,
                    Description = $"Subscription to {inv.PlanName} plan for {inv.PeriodStartDate:MMMM yyyy}",
                    PeriodStartDate = inv.PeriodStartDate,
                    PeriodEndDate = inv.PeriodEndDate,
                    Quantity = 1m,
                    UnitOfMeasure = "unit",
                    UnitPrice = inv.SubtotalAmount,
                    VatRate = inv.VatRate,
                    NetAmount = inv.SubtotalAmount,
                    VatAmount = inv.VatAmount,
                    GrossAmount = inv.TotalAmount,
                    Status = inv.Status.ToString()
                };
            })
            .OrderBy(i => i.IssuedDate)
            .ToList();
    }

    // ============= Private Helpers =============

    private async Task<int> GetNextInvoiceNumberAsync(Guid condominiumId)
    {
        var currentYear = DateTime.UtcNow.Year;
        
        var lastInvoice = (await _invoicesRepo.FindAsync(
            i => i.CondominiumId == condominiumId && i.Year == currentYear
        ))
            .OrderByDescending(i => i.Number)
            .FirstOrDefault();

        return (lastInvoice?.Number ?? 0) + 1;
    }

    private InvoiceDto MapInvoiceToDto(Invoice invoice)
    {
        // Decrypt and mask the tax ID
        var maskedTaxId = string.Empty;
        if (!string.IsNullOrEmpty(invoice.CustomerTaxIdEncrypted))
        {
            var decryptedTaxId = _encryptionService.Decrypt(invoice.CustomerTaxIdEncrypted);
            maskedTaxId = MaskTaxId(decryptedTaxId);
        }

        return new InvoiceDto
        {
            Id = invoice.Id,
            Number = invoice.Number,
            Series = invoice.Series,
            Year = invoice.Year,
            IssuedDate = invoice.IssuedDate,
            DueDate = invoice.DueDate,
            PaidDate = invoice.PaidDate,
            CondominiumId = invoice.CondominiumId,
            CustomerName = invoice.CustomerName,
            CustomerTaxId = maskedTaxId,
            CustomerAddress = invoice.CustomerAddress,
            PlanName = invoice.PlanName,
            PeriodStartDate = invoice.PeriodStartDate,
            PeriodEndDate = invoice.PeriodEndDate,
            SubtotalAmount = invoice.SubtotalAmount,
            VatAmount = invoice.VatAmount,
            TotalAmount = invoice.TotalAmount,
            VatRate = invoice.VatRate,
            Status = invoice.Status.ToString(),
            Notes = invoice.Notes,
            PdfUrl = invoice.PdfPath,
            CreatedAt = invoice.CreatedAt,
            UpdatedAt = invoice.UpdatedAt
        };
    }

    /// <summary>
    /// Mask a tax ID showing only last 4 digits.
    /// Example: 505123456 becomes *****3456
    /// </summary>
    private string MaskTaxId(string taxId)
    {
        if (string.IsNullOrEmpty(taxId) || taxId.Length < 4)
            return taxId;

        return new string('*', taxId.Length - 4) + taxId.Substring(taxId.Length - 4);
    }

    /// <summary>
    /// Send invoice notification email to the condominium's contact address.
    /// Fire-and-forget: exceptions are logged but don't block invoice creation.
    /// </summary>
    private async Task SendInvoiceEmailAsync(Invoice invoice, Condominium condominium)
    {
        try
        {
            if (string.IsNullOrEmpty(condominium.Email))
            {
                _logger.LogWarning("Invoice {InvoiceId}: condominium {CondominiumId} has no email address",
                    invoice.Id, condominium.Id);
                return;
            }

            var invoiceRef  = $"{invoice.Series}-{invoice.Number:D6}/{invoice.Year}";
            var subject     = $"Nova Fatura HABITUS - {invoiceRef}";
            var htmlBody    = BuildInvoiceEmailHtml(invoice, condominium, invoiceRef);

            await _emailService.SendAsync(
                condominium.Email,
                subject,
                htmlBody,
                EmailSenderType.System);

            _logger.LogInformation("Invoice email sent to {Email} for invoice {InvoiceRef}",
                condominium.Email, invoiceRef);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send invoice email for invoice {InvoiceId}", invoice.Id);
        }
    }

    /// <summary>
    /// Build HTML body for the invoice notification email (Portuguese).
    /// </summary>
    private string BuildInvoiceEmailHtml(Invoice invoice, Condominium condominium, string invoiceRef)
    {
        var frontendBase = _configuration["Frontend:BaseUrl"] ?? "https://habitus.app";
        var downloadLink = !string.IsNullOrEmpty(invoice.PdfPath)
            ? invoice.PdfPath
            : $"{frontendBase}/invoices/{invoice.Id}";

        return $"""
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:#1a56db;padding:28px 32px;">
          <h1 style="color:#fff;margin:0;font-size:24px;">HABITUS</h1>
          <p  style="color:#93c5fd;margin:4px 0 0;font-size:12px;">Plataforma de Gestão de Condomínios</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;color:#374151;">
          <h2 style="margin:0 0 16px;font-size:18px;">Olá, {condominium.Name}</h2>
          <p  style="margin:0 0 24px;line-height:1.6;">Foi emitida uma nova fatura para o seu condomínio.</p>

          <!-- Details box -->
          <table width="100%" cellpadding="12" cellspacing="0" style="background:#f9fafb;border-radius:6px;margin-bottom:24px;">
            <tr><td style="font-size:14px;">
              <strong>Referência:</strong> {invoiceRef}<br>
              <strong>Data de emissão:</strong> {invoice.IssuedDate:dd/MM/yyyy}<br>
              <strong>Data de vencimento:</strong> {invoice.DueDate:dd/MM/yyyy}<br>
              <strong style="font-size:16px;">Valor total: €{invoice.TotalAmount:F2}</strong>
            </td></tr>
          </table>

          <!-- CTA button -->
          <div style="text-align:center;margin:0 0 24px;">
            <a href="{downloadLink}" style="background:#1a56db;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Descarregar Fatura PDF</a>
          </div>

          <!-- Payment note -->
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:14px;font-size:13px;">
            <strong>Importante:</strong> proceda ao pagamento até {invoice.DueDate:dd/MM/yyyy}.
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;">
          Este é um email automático — não responda a esta mensagem.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""";
    }

    /// <summary>
    /// Generate invoice PDF and store in blob storage.
    /// Returns the URL where the PDF is stored.
    /// </summary>
    private async Task<string?> GenerateAndStorePdfAsync(Invoice invoice, string companyNif)
    {
        try
        {
            // Generate PDF bytes
            var pdfBytes = _pdfService.GenerateInvoicePdf(invoice, companyNif);
            
            if (pdfBytes == null || pdfBytes.Length == 0)
                return null;

            // Create filename: HABITUS-2026-001.pdf
            var fileName = $"HABITUS-{invoice.Year}-{invoice.Number:D6}.pdf";
            
            // Upload to blob storage
            var pdfUrl = await _blobStorageService.UploadAsync(
                new MemoryStream(pdfBytes),
                fileName,
                "application/pdf");

            return pdfUrl;
        }
        catch (Exception ex)
        {
            // Log but don't throw - invoice should still be created even if PDF fails
            _logger.LogError(ex, "Error storing PDF for invoice {InvoiceId}", invoice.Id);
            return null;
        }
    }

    // ============= Payment Gateway =============

    /// <summary>
    /// Create a gateway payment session for an invoice and store its session ID.
    /// Returns the checkout URL to redirect the user.
    /// </summary>
    public async Task<InitiateInvoicePaymentResponse> InitiateInvoicePaymentAsync(
        Guid invoiceId,
        IPaymentGatewayService gateway,
        string successUrl,
        string cancelUrl)
    {
        var invoice = await _invoicesRepo.GetByIdAsync(invoiceId)
            ?? throw new InvalidOperationException($"Invoice {invoiceId} not found");

        if (invoice.Status == InvoiceStatus.Paid)
            throw new InvalidOperationException("Invoice is already paid");

        if (invoice.Status == InvoiceStatus.Cancelled)
            throw new InvalidOperationException("Cannot initiate payment on a cancelled invoice");

        if (invoice.Status == InvoiceStatus.Draft)
            throw new InvalidOperationException("Invoice must be emitted before payment can be initiated");

        var description = $"Habitus - {invoice.PlanName} ({invoice.Series}-{invoice.Year}/{invoice.Number:D3})";

        var session = await gateway.CreatePaymentSessionAsync(
            invoiceId,
            invoice.TotalAmount,
            "eur",
            description,
            successUrl,
            cancelUrl);

        // Persist session ID so the webhook can resolve it
        invoice.PaymentSessionId = session.SessionId;
        invoice.UpdatedAt = DateTime.UtcNow;
        _invoicesRepo.Update(invoice);
        await _invoicesRepo.SaveChangesAsync();

        return new InitiateInvoicePaymentResponse
        {
            PaymentUrl = session.PaymentUrl,
            SessionId = session.SessionId
        };
    }

    /// <summary>
    /// Process an inbound webhook event from the payment gateway.
    /// Returns true when the event was a successful payment and the invoice was marked paid.
    /// </summary>
    public async Task<bool> HandlePaymentWebhookAsync(
        IPaymentGatewayService gateway,
        string payload,
        string signatureHeader)
    {
        var result = await gateway.HandleWebhookAsync(payload, signatureHeader);

        if (!result.IsPaymentSucceeded || result.InvoiceId == null)
            return false;

        try
        {
            await MarkInvoiceAsPaidAsync(
                result.InvoiceId.Value,
                paidDate: DateTime.UtcNow,
                notes: $"Auto-paid via gateway. Reference: {result.GatewayReference}");

            _logger.LogInformation(
                "Invoice {InvoiceId} auto-marked as paid via gateway reference {Ref}",
                result.InvoiceId, result.GatewayReference);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to mark invoice {InvoiceId} as paid after webhook", result.InvoiceId);
            return false;
        }
    }
}


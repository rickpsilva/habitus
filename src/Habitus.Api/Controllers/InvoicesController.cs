using System.Security.Claims;
using Habitus.Application.DTOs.Billing;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/platform/[controller]")]
[Authorize]
public class InvoicesController : ControllerBase
{
    private readonly InvoiceService _invoiceService;
    private readonly InvoicePdfService _pdfService;
    private readonly SaftXmlService _saftXmlService;
    private readonly IPaymentGatewayService _paymentGateway;
    private readonly IConfiguration _configuration;
    private readonly ILogger<InvoicesController> _logger;

    public InvoicesController(
        InvoiceService invoiceService,
        InvoicePdfService pdfService,
        SaftXmlService saftXmlService,
        IPaymentGatewayService paymentGateway,
        IConfiguration configuration,
        ILogger<InvoicesController> logger)
    {
        _invoiceService = invoiceService;
        _pdfService = pdfService;
        _saftXmlService = saftXmlService;
        _paymentGateway = paymentGateway;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Get all invoices for a condominium.
    /// Accessible by Manager and residents of that condominium.
    /// </summary>
    [HttpGet("{condominiumId:guid}")]
    public async Task<IActionResult> GetCondominiumInvoices(Guid condominiumId)
    {
        // Authorization: Manager can access any condominium, Resident only their own
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;

        if (userRole != "Manager" && userCondominiumId != condominiumId.ToString())
        {
            return Forbid("You don't have access to this condominium's invoices");
        }

        try
        {
            var invoices = await _invoiceService.GetCondominiumInvoicesAsync(condominiumId);
            return Ok(invoices);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving invoices for condominium {CondominiumId}", condominiumId);
            return StatusCode(500, "Error retrieving invoices");
        }
    }

    /// <summary>
    /// Get a specific invoice details.
    /// </summary>
    [HttpGet("detail/{invoiceId:guid}")]
    public async Task<IActionResult> GetInvoice(Guid invoiceId)
    {
        try
        {
            var invoice = await _invoiceService.GetInvoiceAsync(invoiceId);
            if (invoice == null)
                return NotFound("Invoice not found");

            // Authorization: Manager or condominium resident
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            if (userRole != "Manager")
            {
                var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
                if (userCondominiumId != invoice.CondominiumId.ToString())
                    return Forbid();
            }

            return Ok(invoice);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving invoice {InvoiceId}", invoiceId);
            return StatusCode(500, "Error retrieving invoice");
        }
    }

    /// <summary>
    /// Download invoice as PDF.
    /// </summary>
    [HttpGet("detail/{invoiceId:guid}/pdf")]
    public async Task<IActionResult> DownloadInvoicePdf(Guid invoiceId)
    {
        try
        {
            var invoice = await _invoiceService.GetInvoiceAsync(invoiceId);
            if (invoice == null)
                return NotFound("Invoice not found");

            // Authorization
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            if (userRole != "Manager")
            {
                var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
                if (userCondominiumId != invoice.CondominiumId.ToString())
                    return Forbid();
            }

            // If PDF URL is stored, redirect to it (blob storage URL)
            if (!string.IsNullOrEmpty(invoice.PdfUrl))
            {
                // Return PDF from blob storage
                return Redirect(invoice.PdfUrl);
            }

            // Fallback: Generate PDF on-the-fly if not stored
            // TODO: Implement this fallback with full invoice entity
            return StatusCode(501, "PDF generation in progress");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating PDF for invoice {InvoiceId}", invoiceId);
            return StatusCode(500, "Error generating invoice PDF");
        }
    }

    /// <summary>
    /// Mark an invoice as paid.
    /// Manager only.
    /// </summary>
    [HttpPost("detail/{invoiceId:guid}/mark-paid")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> MarkInvoiceAsPaid(
        Guid invoiceId,
        [FromBody] MarkInvoicePaidRequest request)
    {
        try
        {
            var invoice = await _invoiceService.MarkInvoiceAsPaidAsync(
                invoiceId,
                request.PaidDate,
                request.Notes);

            return Ok(invoice);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking invoice {InvoiceId} as paid", invoiceId);
            return StatusCode(500, "Error updating invoice");
        }
    }

    /// <summary>
    /// Cancel an invoice.
    /// Manager only.
    /// </summary>
    [HttpPost("detail/{invoiceId:guid}/cancel")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> CancelInvoice(
        Guid invoiceId,
        [FromBody] CancelInvoiceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest("Cancellation reason is required");

        try
        {
            var invoice = await _invoiceService.CancelInvoiceAsync(
                invoiceId,
                request.Reason,
                request.Notes);

            return Ok(invoice);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error canceling invoice {InvoiceId}", invoiceId);
            return StatusCode(500, "Error canceling invoice");
        }
    }

    /// <summary>
    /// Generate invoices for all due subscriptions.
    /// Manager only. Called manually or by background job.
    /// </summary>
    [HttpPost("generate-due")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GenerateDueInvoices()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var generatedCount = await _invoiceService.GenerateDueInvoicesAsync(
                userId != null ? Guid.Parse(userId) : null);

            return Ok(new { message = $"Geradas {generatedCount} faturas." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating due invoices");
            return StatusCode(500, "Error generating invoices");
        }
    }

    /// <summary>
    /// Export invoices as SAF-T PT XML (Portaria n.º 302/2016).
    /// Returns JSON summary by default; append ?format=xml to download the XML file.
    /// Manager only.
    /// </summary>
    [HttpGet("{condominiumId:guid}/saft")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> ExportSaftInvoices(
        Guid condominiumId,
        [FromQuery] int year,
        [FromQuery] string format = "json")
    {
        if (year < 2020 || year > DateTime.Now.Year + 1)
            return BadRequest("Invalid year for SAF-T export");

        try
        {
            var saftInvoices = await _invoiceService.ExportSaftInvoicesAsync(condominiumId, year);

            if (format.Equals("xml", StringComparison.OrdinalIgnoreCase))
            {
                // Fetch condominium info for the XML header
                var condominiumInfo = await _invoiceService.GetCondominiumInfoAsync(condominiumId);
                if (condominiumInfo == null)
                    return NotFound("Condominium not found");

                var xml = _saftXmlService.GenerateSaftXml(
                    condominiumId,
                    condominiumInfo.Name,
                    condominiumInfo.TaxId,
                    condominiumInfo.Address,
                    year,
                    saftInvoices);

                var fileName = $"SAFT-PT_{condominiumId}_{year}.xml";
                return File(
                    System.Text.Encoding.UTF8.GetBytes(xml),
                    "application/xml",
                    fileName);
            }

            // Default: JSON summary for the dashboard
            return Ok(new
            {
                condominium_id  = condominiumId,
                year            = year,
                invoice_count   = saftInvoices.Count,
                total_amount    = saftInvoices.Sum(i => i.GrossAmount),
                invoices        = saftInvoices
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting SAF-T invoices for condominium {CondominiumId}", condominiumId);
            return StatusCode(500, "Error exporting SAF-T data");
        }
    }

    // ============= Payment Gateway =============

    /// <summary>
    /// Initiate a payment for an invoice via the configured gateway (Stripe).
    /// Returns a checkout URL to redirect the user.
    /// Manager or condominium resident only.
    /// </summary>
    [HttpPost("detail/{invoiceId:guid}/initiate-payment")]
    public async Task<IActionResult> InitiatePayment(Guid invoiceId)
    {
        try
        {
            var invoice = await _invoiceService.GetInvoiceAsync(invoiceId);
            if (invoice == null)
                return NotFound("Invoice not found");

            // Authorization: Manager or resident of the same condominium
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            if (userRole != "Manager")
            {
                var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
                if (userCondominiumId != invoice.CondominiumId.ToString())
                    return Forbid();
            }

            var frontendBase = _configuration["Frontend:BaseUrl"]?.TrimEnd('/') ?? string.Empty;
            var successUrl = $"{frontendBase}/invoices/{invoiceId}/payment-success";
            var cancelUrl  = $"{frontendBase}/invoices/{invoiceId}";

            var result = await _invoiceService.InitiateInvoicePaymentAsync(
                invoiceId,
                _paymentGateway,
                successUrl,
                cancelUrl);

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating payment for invoice {InvoiceId}", invoiceId);
            return StatusCode(500, "Error initiating payment");
        }
    }

    /// <summary>
    /// Stripe webhook endpoint.
    /// No authentication — Stripe signs the payload with HMAC-SHA256.
    /// Must read raw body BEFORE any JSON middleware touches it.
    /// </summary>
    [HttpPost("webhooks/stripe")]
    [AllowAnonymous]
    public async Task<IActionResult> StripeWebhook()
    {
        string payload;
        using (var reader = new System.IO.StreamReader(Request.Body))
        {
            payload = await reader.ReadToEndAsync();
        }

        var signature = Request.Headers["Stripe-Signature"].FirstOrDefault() ?? string.Empty;

        try
        {
            var handled = await _invoiceService.HandlePaymentWebhookAsync(
                _paymentGateway,
                payload,
                signature);

            if (!handled)
            {
                // Not a handled event type — still return 200 so Stripe doesn't retry
                return Ok(new { received = true, handled = false });
            }

            return Ok(new { received = true, handled = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stripe webhook processing error");
            // Return 200 so Stripe doesn't retry on transient errors;
            // the failure is already logged for manual reconciliation.
            return Ok(new { received = true, error = "processing_error" });
        }
    }
}

using Habitus.Application.DTOs.Payments;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/payments")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly PaymentService _service;
    private readonly ReceiptService _receiptService;
    private readonly IRepository<Document> _documentRepository;
    private readonly IBlobStorageService _blobStorage;

    public PaymentsController(
        PaymentService service,
        ReceiptService receiptService,
        IRepository<Document> documentRepository,
        IBlobStorageService blobStorage)
    {
        _service = service;
        _receiptService = receiptService;
        _documentRepository = documentRepository;
        _blobStorage = blobStorage;
    }

    /// <summary>
    /// Create a new payment (Resident or Internal Admin)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Resident,Admin")]
    public async Task<IActionResult> Create([FromBody] CreatePaymentRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (IsAdminWithoutAssignedUnit())
                return Forbid();

            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var unitId = Guid.Parse(User.FindFirstValue("UnitId")!);
            var condominiumId = Guid.Parse(User.FindFirstValue("CondominiumId")!);

            var result = await _service.CreateAsync(request, userId, unitId, condominiumId);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get payment by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var payment = await _service.GetByIdAsync(id);
            if (payment == null)
                return NotFound();

            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var isAdmin = User.IsInRole("Admin");

            // Residents can only view their own payments
            if (!isAdmin && payment.ResidentId != userId)
                return Forbid();

            return Ok(payment);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get all payments for the current resident/internal admin
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Resident,Admin")]
    public async Task<IActionResult> GetMyPayments()
    {
        try
        {
            if (IsAdminWithoutAssignedUnit())
                return Forbid();

            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var payments = await _service.GetByResidentAsync(userId);
            return Ok(payments);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get all pending payments (Admin only)
    /// </summary>
    [HttpGet("pending")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetPending()
    {
        try
        {
            var condominiumId = Guid.Parse(User.FindFirstValue("CondominiumId")!);
            var payments = await _service.GetPendingAsync(condominiumId);
            return Ok(payments);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get paginated payments (Admin only)
    /// </summary>
    [HttpGet("paged")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        try
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 10;

            var condominiumId = Guid.Parse(User.FindFirstValue("CondominiumId")!);
            var result = await _service.GetPagedAsync(condominiumId, page, pageSize);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Approve a payment (Admin only)
    /// </summary>
    [HttpPut("{id}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApprovePaymentRequest? request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _service.ApproveAsync(id, userId, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Reject a payment (Admin only)
    /// </summary>
    [HttpPut("{id}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectPaymentRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _service.RejectAsync(id, userId, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Cancel a pending payment (Resident or Internal Admin)
    /// </summary>
    [HttpPut("{id}/cancel")]
    [Authorize(Roles = "Resident,Admin")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        try
        {
            if (IsAdminWithoutAssignedUnit())
                return Forbid();

            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _service.CancelAsync(id, userId);
            
            if (result == null)
                return NotFound(new { message = "Pagamento não encontrado." });

            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Upload proof of payment (Resident or Internal Admin)
    /// </summary>
    [HttpPost("{id}/proof")]
    [Authorize(Roles = "Resident,Admin")]
    public async Task<IActionResult> UploadProof(Guid id, [FromBody] UploadProofRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.ProofUrl))
                return BadRequest(new { message = "O comprovativo de pagamento é obrigatório." });

            if (IsAdminWithoutAssignedUnit())
                return Forbid();

            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var success = await _service.UpdateProofOfPaymentAsync(id, request.ProofUrl, userId);
            
            if (!success)
                return NotFound(new { message = "Pagamento não encontrado ou não pode ser atualizado." });

            return Ok(new { message = "Comprovativo de pagamento enviado com sucesso." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Download proof of payment for a payment
    /// </summary>
    [HttpGet("{id}/proof/download")]
    [Authorize(Roles = "Resident,Admin")]
    public async Task<IActionResult> DownloadProof(Guid id)
    {
        try
        {
            if (IsAdminWithoutAssignedUnit())
                return Forbid();

            var payment = await _service.GetByIdAsync(id);
            if (payment == null)
                return NotFound(new { message = "Pagamento não encontrado." });

            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && payment.ResidentId != userId)
                return Forbid();

            if (isAdmin)
            {
                var condominiumIdClaim = User.FindFirstValue("CondominiumId");
                if (!Guid.TryParse(condominiumIdClaim, out var adminCondominiumId) || payment.CondominiumId != adminCondominiumId)
                    return Forbid();
            }

            if (string.IsNullOrWhiteSpace(payment.ProofOfPaymentUrl))
                return NotFound(new { message = "Comprovativo não encontrado para este pagamento." });

            var storagePath = payment.ProofOfPaymentUrl;
            var fallbackFileName = $"Comprovativo_{payment.Id}";
            string? fallbackContentType = null;

            if (Guid.TryParse(payment.ProofOfPaymentUrl, out var documentId))
            {
                var document = await _documentRepository.GetByIdAsync(documentId);
                if (document != null)
                {
                    storagePath = document.FilePath;
                    fallbackFileName = document.Name;
                    fallbackContentType = document.MimeType;
                }
            }

            var (stream, contentType) = await _blobStorage.DownloadAsync(storagePath);
            return File(stream, contentType ?? fallbackContentType ?? "application/octet-stream", fallbackFileName);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { message = "Ficheiro de comprovativo não encontrado." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Issue receipt for an approved payment (Admin only)
    /// </summary>
    [HttpPost("{id}/issue-receipt")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> IssueReceipt(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var pdfPath = await _receiptService.GenerateReceiptPdfAsync(id, userId);
            
            // Refresh payment to get updated receipt info
            var payment = await _service.GetByIdAsync(id);
            return Ok(new { message = "Recibo emitido com sucesso.", receipt = new { 
                number = payment?.ReceiptNumber, 
                year = payment?.ReceiptYear,
                issuedDate = payment?.ReceiptIssuedDate,
                pdfPath = pdfPath
            }});
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Download receipt PDF for a payment
    /// </summary>
    [HttpGet("{id}/receipt")]
    public async Task<IActionResult> DownloadReceipt(Guid id)
    {
        try
        {
            var payment = await _service.GetByIdAsync(id);
            if (payment == null)
                return NotFound(new { message = "Pagamento não encontrado." });

            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var isAdmin = User.IsInRole("Admin");

            // Residents can only download their own receipts
            if (!isAdmin && payment.ResidentId != userId)
                return Forbid();

            if (string.IsNullOrEmpty(payment.ReceiptPdfPath) || !payment.ReceiptNumber.HasValue)
                return NotFound(new { message = "Recibo ainda não emitido para este pagamento." });

            var filePath = Path.Combine(Directory.GetCurrentDirectory(), payment.ReceiptPdfPath.TrimStart('/'));
            
            if (!System.IO.File.Exists(filePath))
                return NotFound(new { message = "Ficheiro de recibo não encontrado." });

            var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
            var fileName = $"Recibo_{payment.ReceiptNumber}_{payment.ReceiptYear}.pdf";
            
            return File(fileBytes, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    private bool IsAdminWithoutAssignedUnit()
    {
        return User.IsInRole("Admin") && !Guid.TryParse(User.FindFirstValue("UnitId"), out _);
    }
}

public class UploadProofRequest
{
    public string ProofUrl { get; set; } = string.Empty;
}

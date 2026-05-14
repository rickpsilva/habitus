namespace Habitus.Application.DTOs.Payments;

public class PaymentDto
{
    public Guid Id { get; set; }
    public Guid ResidentId { get; set; }
    public string ResidentName { get; set; } = string.Empty;
    public Guid UnitId { get; set; }
    public string UnitIdentifier { get; set; } = string.Empty;
    public Guid CondominiumId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? ProofOfPaymentUrl { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime? ProcessedDate { get; set; }
    public string? RejectionReason { get; set; }
    public string? ProcessedByUserName { get; set; }
    public Guid? FinancialRecordId { get; set; }
    public Guid? ReservationId { get; set; }
    
    // Receipt information
    public int? ReceiptNumber { get; set; }
    public int? ReceiptYear { get; set; }
    public DateTime? ReceiptIssuedDate { get; set; }
    public string? ReceiptIssuedByUserName { get; set; }
    public string? ReceiptPdfPath { get; set; }
    public bool HasReceipt => ReceiptNumber.HasValue && ReceiptYear.HasValue;

    // Quota period fields
    public string? QuotaPeriodicity { get; set; }
    public int? QuotaMonthStart { get; set; }
    public int? QuotaMonthEnd { get; set; }
    public int? QuotaYear { get; set; }
}

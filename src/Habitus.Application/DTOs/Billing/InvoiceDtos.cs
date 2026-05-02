namespace Habitus.Application.DTOs.Billing;

/// <summary>
/// Minimal condominium info used by invoice services (PDF, SAF-T, email).
/// </summary>
public class CondominiumInfoDto
{
    public Guid    Id      { get; set; }
    public string  Name    { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Email   { get; set; }
    public string? TaxId   { get; set; }
}

/// <summary>
/// DTO for invoice list/detail responses.
/// </summary>
public class InvoiceDto
{
    public Guid Id { get; set; }
    
    // Invoice Identification
    public int Number { get; set; }
    public string Series { get; set; } = string.Empty;
    public int Year { get; set; }
    public string InvoiceRef => $"{Series}-{Number}/{Year}"; // E.g., "HABITUS-1/2026"
    
    // Dates
    public DateTime IssuedDate { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? PaidDate { get; set; }
    
    // Customer Info
    public Guid CondominiumId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerTaxId { get; set; }
    public string? CustomerAddress { get; set; }
    
    // Subscription/Service Info
    public string PlanName { get; set; } = string.Empty;
    public DateTime PeriodStartDate { get; set; }
    public DateTime PeriodEndDate { get; set; }
    
    // Amounts (EUR)
    public decimal SubtotalAmount { get; set; }
    public decimal VatAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal VatRate { get; set; } // 0.23 = 23%
    
    // Status
    public string Status { get; set; } = string.Empty; // Draft, Emitted, Paid, Overdue, Cancelled
    public bool IsPaid => Status == "Paid";
    public bool IsOverdue => Status == "Overdue" || (DateTime.UtcNow > DueDate && Status != "Paid" && Status != "Cancelled");
    
    // Metadata
    public string? Notes { get; set; }
    public string? PdfUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Request to mark an invoice as paid.
/// </summary>
public class MarkInvoicePaidRequest
{
    /// <summary>
    /// Date payment was received (defaults to today if not provided).
    /// </summary>
    public DateTime? PaidDate { get; set; }
    
    /// <summary>
    /// Optional notes about payment (e.g., bank transfer ID, reference).
    /// </summary>
    public string? Notes { get; set; }
}

/// <summary>
/// Request to cancel an invoice.
/// </summary>
public class CancelInvoiceRequest
{
    /// <summary>
    /// Reason for cancellation (required for audit).
    /// </summary>
    public string Reason { get; set; } = string.Empty;
    
    /// <summary>
    /// Notes about cancellation.
    /// </summary>
    public string? Notes { get; set; }
}

/// <summary>
/// Invoice summary for lists (minimal info).
/// </summary>
public class InvoiceSummaryDto
{
    public Guid Id { get; set; }
    public string InvoiceRef { get; set; } = string.Empty; // "HABITUS-1/2026"
    public DateTime IssuedDate { get; set; }
    public DateTime DueDate { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsOverdue => DateTime.UtcNow > DueDate && Status != "Paid" && Status != "Cancelled";
}

/// <summary>
/// Invoice for SAF-T export.
/// Contains all tax-relevant information.
/// </summary>
public class SaftInvoiceDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty; // FT or FR
    public string InvoiceRef { get; set; } = string.Empty;
    public DateTime IssuedDate { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? PaidDate { get; set; }
    
    // Customer
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerTaxId { get; set; }
    public string? CustomerAddress { get; set; }
    
    // Line Item (single line for subscription service)
    public string Description { get; set; } = string.Empty; // "Subscription to Gold Plan for April 2026"
    public DateTime PeriodStartDate { get; set; }
    public DateTime PeriodEndDate { get; set; }
    public decimal Quantity { get; set; } = 1m;
    public string UnitOfMeasure { get; set; } = "unit";
    public decimal UnitPrice { get; set; }
    
    // Tax
    public decimal VatRate { get; set; } = 0.23m;
    public decimal NetAmount { get; set; }
    public decimal VatAmount { get; set; }
    public decimal GrossAmount { get; set; }
    
    // Status
    public string Status { get; set; } = string.Empty; // Draft, Emitted, Paid, Overdue, Cancelled
}

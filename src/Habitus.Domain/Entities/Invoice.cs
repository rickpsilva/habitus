namespace Habitus.Domain.Entities;

/// <summary>
/// Invoice status tracking (SAF-T compatible).
/// FT = Fatura; FR = Fatura Recibo
/// </summary>
public enum InvoiceStatus
{
    Draft,      // Rascunho (não emitida)
    Emitted,    // Emitida
    Paid,       // Paga
    Overdue,    // Vencida (não paga)
    Cancelled   // Cancelada
}

/// <summary>
/// Invoice type for SAF-T reporting.
/// FT = Normal Invoice; FR = Invoice-Receipt (Combined)
/// </summary>
public enum InvoiceType
{
    FT,  // Fatura (Invoice)
    FR   // Fatura-Recibo (Invoice-Receipt - immediate payment)
}

/// <summary>
/// Represents a subscription invoice (platform service billing).
/// Fields are designed to be SAF-T compatible for Portuguese tax authority (AT) reporting.
/// See: https://info.portaldasfinancas.gov.pt/pt/
/// </summary>
public class Invoice
{
    // ============= Core Identity (SAF-T Required) =============
    public Guid Id { get; set; }
    
    /// <summary>
    /// Sequential invoice number per condominium per year (e.g., 1, 2, 3...).
    /// SAF-T: InvoiceNumber
    /// </summary>
    public int Number { get; set; }
    
    /// <summary>
    /// Invoice series (e.g., "HABITUS2026", "A", "B"). Max 8 chars.
    /// SAF-T: Series (optional, for multiple invoice series)
    /// </summary>
    public string Series { get; set; } = "HABITUS"; // Default series
    
    /// <summary>
    /// Year of issuance. Used for sequential numbering reset.
    /// SAF-T: InvoiceDate.Year
    /// </summary>
    public int Year { get; set; }
    
    /// <summary>
    /// Type: FT (Invoice) or FR (Invoice-Receipt).
    /// SAF-T: InvoiceType
    /// </summary>
    public InvoiceType Type { get; set; } = InvoiceType.FT;
    
    // ============= Dates (SAF-T Required) =============
    
    /// <summary>
    /// Date invoice was emitted.
    /// SAF-T: InvoiceDate
    /// </summary>
    public DateTime IssuedDate { get; set; }
    
    /// <summary>
    /// Due date for payment (N days from IssuedDate).
    /// SAF-T: DueDate
    /// </summary>
    public DateTime DueDate { get; set; }
    
    /// <summary>
    /// Date payment was received (if Status == Paid).
    /// SAF-T: SettlementDate
    /// </summary>
    public DateTime? PaidDate { get; set; }
    
    // ============= Customer (SAF-T Required) =============
    
    /// <summary>
    /// Condominium being invoiced.
    /// SAF-T: CustomerInfo.CompanyID (NIF)
    /// </summary>
    public Guid CondominiumId { get; set; }
    
    /// <summary>
    /// Customer name stored at invoice time (immutable snapshot for history).
    /// SAF-T: CustomerInfo.CompanyName
    /// </summary>
    public string CustomerName { get; set; } = string.Empty;
    
    /// <summary>
    /// Customer Tax ID (NIF - Número de Identificação Fiscal).
    /// SAF-T: CustomerInfo.CompanyID
    /// ⚠️ DEPRECATED: Use CustomerTaxIdEncrypted instead. This field is kept for reference only.
    /// </summary>
    [Obsolete("Use GetCustomerTaxId() method instead")]
    public string? CustomerTaxId { get; set; }
    
    /// <summary>
    /// Customer Tax ID encrypted with AES-256-GCM (RGPD compliant).
    /// Stores NIF securely in database.
    /// </summary>
    public string? CustomerTaxIdEncrypted { get; set; }
    
    /// <summary>
    /// Customer address snapshot (for communication + SAF-T compliance).
    /// </summary>
    [Obsolete("Use CustomerAddressEncrypted instead")]
    public string? CustomerAddress { get; set; }

    /// <summary>
    /// Customer address encrypted with AES-256-GCM (RGPD compliant).
    /// </summary>
    public string? CustomerAddressEncrypted { get; set; }
    
    // ============= Subscription Reference =============
    
    /// <summary>
    /// Subscription being invoiced (link to CondominiumSubscription).
    /// </summary>
    public Guid SubscriptionId { get; set; }
    
    /// <summary>
    /// Plan name at invoice time (immutable snapshot).
    /// </summary>
    public string PlanName { get; set; } = string.Empty;
    
    // ============= Billing Period (SAF-T Detail) =============
    
    /// <summary>
    /// Start date of the billing period covered by this invoice.
    /// SAF-T: Period start (in line item details).
    /// </summary>
    public DateTime PeriodStartDate { get; set; }
    
    /// <summary>
    /// End date of the billing period covered by this invoice.
    /// SAF-T: Period end (in line item details).
    /// </summary>
    public DateTime PeriodEndDate { get; set; }
    
    // ============= Amounts (SAF-T Required) =============
    
    /// <summary>
    /// Subtotal (without VAT). In EUR cents for precision.
    /// SAF-T: GrossTotal - VATTotal
    /// </summary>
    public decimal SubtotalAmount { get; set; }
    
    /// <summary>
    /// VAT amount (23% in Portugal).
    /// SAF-T: VATTotal
    /// </summary>
    public decimal VatAmount { get; set; }
    
    /// <summary>
    /// Total amount due (SubtotalAmount + VatAmount).
    /// SAF-T: GrossTotal
    /// </summary>
    public decimal TotalAmount { get; set; }
    
    /// <summary>
    /// VAT rate applied (default 23% for Portugal).
    /// SAF-T: VATRate
    /// </summary>
    public decimal VatRate { get; set; } = 0.23m; // 23% Portugal standard
    
    // ============= Status & Tracking =============
    
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;
    
    /// <summary>
    /// User who emitted the invoice (e.g., platform admin or manager).
    /// SAF-T: Optional (for manual emissions)
    /// </summary>
    public Guid? IssuedByUserId { get; set; }
    
    /// <summary>
    /// File path to stored PDF (e.g., blob storage URL or local path).
    /// </summary>
    public string? PdfPath { get; set; }

    /// <summary>
    /// Gateway payment session ID (e.g., Stripe Checkout session ID).
    /// Used to match webhook events back to this invoice.
    /// </summary>
    public string? PaymentSessionId { get; set; }
    
    /// <summary>
    /// Reference to Document entity if stored.
    /// </summary>
    public Guid? DocumentId { get; set; }
    
    /// <summary>
    /// Reason for cancellation (if Status == Cancelled).
    /// SAF-T: Reason code (for tax reconciliation).
    /// </summary>
    public string? CancellationReason { get; set; }
    
    /// <summary>
    /// If this is a cancellation invoice, reference to original invoice.
    /// SAF-T: Original invoice reference (for credit notes).
    /// </summary>
    public Guid? OriginalInvoiceId { get; set; }
    
    /// <summary>
    /// Notes or additional invoice details (for internal tracking).
    /// </summary>
    public string? Notes { get; set; }
    
    // ============= Audit Trail =============
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedByUserId { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    
    // ============= Encryption Helpers (for PII - RGPD Compliant) =============
    
    /// <summary>
    /// Set the encrypted customer tax ID.
    /// Must be called from InvoiceService with IEncryptionService.
    /// </summary>
    public void SetCustomerTaxIdEncrypted(string? encryptedValue)
    {
        CustomerTaxIdEncrypted = encryptedValue;
        // Keep old field null for new records (backward compat, but field is obsolete)
        CustomerTaxId = null;
    }
    
    /// <summary>
    /// Get decrypted customer tax ID.
    /// Must be called from InvoiceService with IEncryptionService.
    /// </summary>
    public string? GetCustomerTaxIdDecrypted(string? decryptedValue)
    {
        // Returns the decrypted value passed from service
        // This ensures no plaintext NIF is stored in entity
        return decryptedValue;
    }
    
    /// <summary>
    /// Get masked customer tax ID for display (e.g., "1234***789").
    /// Safe to display in logs, UI, etc.
    /// </summary>
    public string? GetCustomerTaxIdMasked()
    {
        if (string.IsNullOrEmpty(CustomerTaxIdEncrypted))
            return null;
        
        // Cannot decrypt here (no access to EncryptionService)
        // Service layer handles masking
        return null;  // Service will mask after decrypting
    }
    
    // ============= Navigation Properties =============
    
    public Condominium Condominium { get; set; } = null!;
    public CondominiumSubscription Subscription { get; set; } = null!;
    public User? IssuedByUser { get; set; }
    public Document? Document { get; set; }
}

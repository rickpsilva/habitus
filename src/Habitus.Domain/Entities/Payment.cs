namespace Habitus.Domain.Entities;

public enum PaymentType
{
    MonthlyFee,        // Quota mensal
    ExtraordinaryFee,  // Quota extraordinária
    Reservation,       // Pagamento de reserva
    Other              // Outro tipo de pagamento
}

public enum PaymentStatus
{
    Pending,   // Aguardando aprovação
    Approved,  // Aprovado pelo admin
    Rejected,  // Rejeitado pelo admin
    Cancelled  // Cancelado pelo residente
}

public enum PaymentMethod
{
    BankTransfer,  // NIB / Transferência Bancária (requer comprovativo)
    MBWay,         // MB Way (automático)
    Card           // Cartão Visa/Maestro (automático)
}

public class Payment
{
    public Guid Id { get; set; }
    public Guid ResidentId { get; set; }
    public Guid UnitId { get; set; }
    public Guid CondominiumId { get; set; }
    public PaymentType Type { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public PaymentStatus Status { get; set; }
    public string? ProofOfPaymentUrl { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime? ProcessedDate { get; set; }
    public string? RejectionReason { get; set; }
    public Guid? ProcessedByUserId { get; set; }
    public Guid? FinancialRecordId { get; set; }
    public Guid? ReservationId { get; set; }
    
    // Receipt information
    public int? ReceiptNumber { get; set; }
    public int? ReceiptYear { get; set; }
    public DateTime? ReceiptIssuedDate { get; set; }
    public Guid? ReceiptIssuedByUserId { get; set; }
    public string? ReceiptPdfPath { get; set; }
    
    // Navigation properties
    public User Resident { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
    public Condominium Condominium { get; set; } = null!;
    public User? ProcessedByUser { get; set; }
    public User? ReceiptIssuedByUser { get; set; }
    public FinancialRecord? FinancialRecord { get; set; }
    public Reservation? Reservation { get; set; }
}

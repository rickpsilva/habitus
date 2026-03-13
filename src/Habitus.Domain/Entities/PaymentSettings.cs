namespace Habitus.Domain.Entities;

public class PaymentSettings
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    // Navigation property is optional - entity can work without it loaded
    public Condominium? Condominium { get; set; }
    
    // Bank Transfer Configuration
    public bool BankTransferEnabled { get; set; } = true;
    public string? BankTransferIban { get; set; }
    public string? BankTransferAccountHolder { get; set; }
    
    // MB Reference Configuration
    public bool MBReferenceEnabled { get; set; } = false;
    public string? MBReferenceEntity { get; set; }  // 5 digits
    public string? MBReferenceReference { get; set; }  // 9 digits
    
    // MB Way Configuration
    public bool MBWayEnabled { get; set; } = false;
    public string? MBWayPhoneNumber { get; set; }
    public string? MBWayMerchantId { get; set; }
    
    // Card Payment Configuration
    public bool CardEnabled { get; set; } = false;
    public string? CardProvider { get; set; }  // stripe, easypay, sibs, paypal, ifthenpay
    public string? CardPublicKey { get; set; }
    public string? CardSecretKey { get; set; }  // Should be encrypted in production
    public string? CardMerchantId { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

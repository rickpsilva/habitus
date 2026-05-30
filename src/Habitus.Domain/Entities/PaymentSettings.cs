namespace Habitus.Domain.Entities;

public class PaymentSettings
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    // Navigation property is optional - entity can work without it loaded
    public Condominium? Condominium { get; set; }
    
    // Bank Transfer Configuration
    public bool BankTransferEnabled { get; set; } = true;
    public string? BankTransferIbanEncrypted { get; set; } // Encrypted IBAN (new field)
    public string? BankTransferAccountHolderEncrypted { get; set; }
    public string? PaymentInstructionsEncrypted { get; set; }
    
    // MB Reference Configuration
    public bool MBReferenceEnabled { get; set; } = false;
    public string? MBReferenceEntityEncrypted { get; set; }
    public string? MBReferenceReferenceEncrypted { get; set; }
    
    // MB Way Configuration
    public bool MBWayEnabled { get; set; } = false;
    public string? MBWayPhoneNumberEncrypted { get; set; }
    public string? MBWayMerchantIdEncrypted { get; set; }
    
    // Card Payment Configuration
    public bool CardEnabled { get; set; } = false;
    public string? CardProvider { get; set; }  // stripe, easypay, sibs, paypal, ifthenpay
    public string? CardPublicKey { get; set; }
    public string? CardSecretKeyEncrypted { get; set; }  // Encrypted secret key (new field)
    public string? CardMerchantIdEncrypted { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

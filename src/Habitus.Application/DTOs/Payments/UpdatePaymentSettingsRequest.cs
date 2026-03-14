namespace Habitus.Application.DTOs.Payments;

public class UpdatePaymentSettingsRequest
{
    // Bank Transfer Configuration
    public bool BankTransferEnabled { get; set; }
    public string? BankTransferIban { get; set; }
    public string? BankTransferAccountHolder { get; set; }
    
    // MB Reference Configuration
    public bool MBReferenceEnabled { get; set; }
    public string? MBReferenceEntity { get; set; }
    public string? MBReferenceReference { get; set; }
    
    // MB Way Configuration
    public bool MBWayEnabled { get; set; }
    public string? MBWayPhoneNumber { get; set; }
    public string? MBWayMerchantId { get; set; }
    
    // Card Payment Configuration
    public bool CardEnabled { get; set; }
    public string? CardProvider { get; set; }
    public string? CardPublicKey { get; set; }
    public string? CardSecretKey { get; set; }  // Only sent when updating, encrypted in storage
    public string? CardMerchantId { get; set; }
}

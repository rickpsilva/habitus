using Habitus.Application.Attributes;

namespace Habitus.Application.DTOs.Payments;

public class PaymentSettingsDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    
    // Bank Transfer Configuration
    public bool BankTransferEnabled { get; set; }
    [SensitiveData(SensitiveDataType.Iban, RequiresRole = "Manager,Admin")]
    public string? BankTransferIban { get; set; }
    public string? BankTransferAccountHolder { get; set; }
    
    // MB Reference Configuration
    public bool MBReferenceEnabled { get; set; }
    public string? MBReferenceEntity { get; set; }
    [SensitiveData(SensitiveDataType.Generic, RequiresRole = "Manager,Admin")]
    public string? MBReferenceReference { get; set; }
    
    // MB Way Configuration
    public bool MBWayEnabled { get; set; }
    [SensitiveData(SensitiveDataType.Phone, RequiresRole = "Manager,Admin")]
    public string? MBWayPhoneNumber { get; set; }
    public string? MBWayMerchantId { get; set; }
    
    // Card Payment Configuration
    public bool CardEnabled { get; set; }
    public string? CardProvider { get; set; }
    public string? CardPublicKey { get; set; }
    // Note: CardSecretKey is NOT included in DTO for security reasons
    public string? CardMerchantId { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

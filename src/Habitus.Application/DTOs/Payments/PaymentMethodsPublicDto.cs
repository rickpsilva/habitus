namespace Habitus.Application.DTOs.Payments;

/// <summary>
/// Public DTO for payment methods information accessible to residents
/// Contains only non-sensitive payment information
/// </summary>
public class PaymentMethodsPublicDto
{
    // Bank Transfer Configuration (public info only)
    public bool BankTransferEnabled { get; set; }
    public string? BankTransferIban { get; set; }
    public string? BankTransferAccountHolder { get; set; }
    
    // MB Reference Configuration (public info only)
    public bool MBReferenceEnabled { get; set; }
    public string? MBReferenceEntity { get; set; }
    public string? MBReferenceReference { get; set; }
    
    // MB Way Configuration (public info only)
    public bool MBWayEnabled { get; set; }
    public string? MBWayPhoneNumber { get; set; }
    
    // Card Payment Configuration (public key only, no secrets)
    public bool CardEnabled { get; set; }
    public string? CardProvider { get; set; }
    public string? CardPublicKey { get; set; }
}

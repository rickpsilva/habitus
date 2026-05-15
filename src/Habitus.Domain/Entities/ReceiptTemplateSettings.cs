namespace Habitus.Domain.Entities;

public class ReceiptTemplateSettings
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public Condominium? Condominium { get; set; }
    
    public string? CompanyName { get; set; }
    public string? Address { get; set; } // [Obsolete] Use AddressEncrypted
    public string? AddressEncrypted { get; set; }
    public string? PostalCode { get; set; } // [Obsolete] Use PostalCodeEncrypted
    public string? PostalCodeEncrypted { get; set; }
    public string? Locality { get; set; } // [Obsolete] Use LocalityEncrypted
    public string? LocalityEncrypted { get; set; }
    public string? TaxId { get; set; } // [Obsolete] Use TaxIdEncrypted
    public string? TaxIdEncrypted { get; set; }
    public string? Email { get; set; } // [Obsolete] Use EmailEncrypted
    public string? EmailEncrypted { get; set; }
    public string? Phone { get; set; } // [Obsolete] Use PhoneEncrypted
    public string? PhoneEncrypted { get; set; }
    public string? Template { get; set; }
    public string? TemplateMonthlyFee { get; set; }
    public string? TemplateMonthlyFeeQuarterly { get; set; }
    public string? TemplateMonthlyFeeAnnual { get; set; }
    public string? TemplateExtraordinaryFee { get; set; }
    public string? TemplateReservation { get; set; }
    public string? TemplateOther { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

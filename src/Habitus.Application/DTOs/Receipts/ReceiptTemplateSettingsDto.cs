namespace Habitus.Application.DTOs.Receipts;

public class ReceiptTemplateSettingsDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public string? Template { get; set; }
    public string? TemplateMonthlyFee { get; set; }
    public string? TemplateMonthlyFeeQuarterly { get; set; }
    public string? TemplateMonthlyFeeAnnual { get; set; }
    public string? TemplateExtraordinaryFee { get; set; }
    public string? TemplateReservation { get; set; }
    public string? TemplateOther { get; set; }
    public bool IncludeCondominiumName { get; set; }
    public bool IncludeTaxId { get; set; }
    public bool IncludeAddress { get; set; }
    public bool IncludePostalCode { get; set; }
    public bool IncludeLocality { get; set; }
    public bool IncludeEmail { get; set; }
    public bool IncludeContactPhone { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

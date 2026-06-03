namespace Habitus.Application.DTOs.Receipts;

public class UpdateReceiptTemplateSettingsRequest
{
    public string? Template { get; set; }
    public string? TemplateMonthlyFee { get; set; }
    public string? TemplateMonthlyFeeQuarterly { get; set; }
    public string? TemplateMonthlyFeeAnnual { get; set; }
    public string? TemplateExtraordinaryFee { get; set; }
    public string? TemplateReservation { get; set; }
    public string? TemplateOther { get; set; }
    public bool IncludeCondominiumName { get; set; } = true;
    public bool IncludeTaxId { get; set; } = true;
    public bool IncludeAddress { get; set; } = true;
    public bool IncludePostalCode { get; set; } = true;
    public bool IncludeLocality { get; set; } = true;
    public bool IncludeEmail { get; set; } = true;
    public bool IncludeContactPhone { get; set; } = true;
}

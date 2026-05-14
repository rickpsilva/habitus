namespace Habitus.Application.DTOs.Receipts;

public class ReceiptTemplateSettingsDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public string? CompanyName { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }
    public string? Locality { get; set; }
    public string? TaxId { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Template { get; set; }
    public string? TemplateMonthlyFee { get; set; }
    public string? TemplateMonthlyFeeQuarterly { get; set; }
    public string? TemplateMonthlyFeeAnnual { get; set; }
    public string? TemplateExtraordinaryFee { get; set; }
    public string? TemplateReservation { get; set; }
    public string? TemplateOther { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

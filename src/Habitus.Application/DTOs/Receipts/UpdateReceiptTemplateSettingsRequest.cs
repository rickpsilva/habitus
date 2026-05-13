namespace Habitus.Application.DTOs.Receipts;

public class UpdateReceiptTemplateSettingsRequest
{
    public string? CompanyName { get; set; }
    public string? Address { get; set; }
    public string? TaxId { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Template { get; set; }
}

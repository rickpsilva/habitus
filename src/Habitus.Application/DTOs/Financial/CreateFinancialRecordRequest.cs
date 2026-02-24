namespace Habitus.Application.DTOs.Financial;

public class CreateFinancialRecordRequest
{
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Category { get; set; } = string.Empty;
    public Guid BuildingId { get; set; }
    public string? ReceiptUrl { get; set; }
}

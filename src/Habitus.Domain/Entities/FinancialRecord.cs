namespace Habitus.Domain.Entities;

public enum FinancialType { Income, Expense }

public class FinancialRecord
{
    public Guid Id { get; set; }
    public FinancialType Type { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Category { get; set; } = string.Empty;
    public Guid BuildingId { get; set; }
    public string? ReceiptUrl { get; set; }
    public Building Building { get; set; } = null!;
}

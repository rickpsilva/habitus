namespace Habitus.Application.DTOs.Financial;

public class FinancialRecordDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public int FiscalYear { get; set; }
    public string? IncomeCategory { get; set; }
    public Guid? ExpenseCategoryId { get; set; }
    public string? ExpenseCategoryName { get; set; }
    public List<string> ExpenseCategoryHashtags { get; set; } = new();
    public string? ReserveFundCategory { get; set; }
    public Guid CondominiumId { get; set; }
    public string? ReceiptUrl { get; set; }

    // Backward-compatible display fields used by the React UI.
    public string Category => IncomeCategory ?? ExpenseCategoryName ?? ReserveFundCategory ?? string.Empty;
    public string CategoryType => Type;
    public List<string> Hashtags => ExpenseCategoryHashtags;
}

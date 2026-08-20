namespace Habitus.Application.DTOs.Financial;

public class AnnualFinancialReportDto
{
    public int Year { get; set; }
    public decimal TotalIncome { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal Balance { get; set; }
    public List<MonthlyFinancialBreakdownDto> MonthlyBreakdown { get; set; } = new();
    public List<CategoryTotalDto> IncomeByCategory { get; set; } = new();
    public List<CategoryTotalDto> ExpensesByTag { get; set; } = new();
    /// <summary>
    /// Monthly breakdown of expenses by tag (rows: tags, columns: months 1-12, last: total).
    /// </summary>
    public List<TagMonthlyBreakdownDto> ExpensesByTagMonthly { get; set; } = new();
}

public class MonthlyFinancialBreakdownDto
{
    public int Month { get; set; }
    public decimal Income { get; set; }
    public decimal Expenses { get; set; }
    public decimal Balance { get; set; }
}

public class CategoryTotalDto
{
    public string Category { get; set; } = string.Empty;
    public decimal Total { get; set; }
}

/// <summary>
/// Represents a row in the monthly expenses by tag table.
/// Can be a Tag header (when IsTagGroup=true) or a Category under a tag.
/// </summary>
public class TagMonthlyBreakdownDto
{
    public string Tag { get; set; } = string.Empty;
    /// <summary>Name of the category (null when this row represents a tag group header).</summary>
    public string? Category { get; set; }
    /// <summary>True if this row is a tag group header, false if it's a category under a tag.</summary>
    public bool IsTagGroup { get; set; }
    /// <summary>Values for months 1-12 (index 0 = January).</summary>
    public List<decimal> MonthlyValues { get; set; } = new();
    public decimal Total { get; set; }
}

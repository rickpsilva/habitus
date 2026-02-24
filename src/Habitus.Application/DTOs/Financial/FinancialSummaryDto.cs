namespace Habitus.Application.DTOs.Financial;

public class FinancialSummaryDto
{
    public decimal TotalIncome { get; set; }
    public decimal TotalExpense { get; set; }
    public decimal Balance { get; set; }
    public List<FinancialRecordDto> Records { get; set; } = new();
}

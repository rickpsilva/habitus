using Habitus.Application.DTOs.Financial;

namespace Habitus.Application.Interfaces;

/// <summary>
/// Interface for complex financial queries that require raw SQL for performance.
/// This avoids pulling large datasets into memory for aggregation.
/// </summary>
public interface IFinancialQueryService
{
    Task<List<MonthlyFinancialBreakdownDto>> GetMonthlyBreakdownAsync(Guid condominiumId, int year);
    Task<List<CategoryTotalDto>> GetIncomeByCategoryAsync(Guid condominiumId, int year);
    Task<List<CategoryTotalDto>> GetExpensesByTagAsync(Guid condominiumId, int year);
    Task<List<TagMonthlyBreakdownDto>> GetExpensesByTagMonthlyAsync(Guid condominiumId, int year);
}
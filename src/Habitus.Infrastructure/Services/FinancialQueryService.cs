using Habitus.Application.DTOs.Financial;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

using System.Text.Json;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Implementation of complex financial queries using raw SQL for performance.
/// This avoids pulling large datasets into memory for aggregation.
/// </summary>
public class FinancialQueryService : IFinancialQueryService
{
    private readonly HabitusDbContext _context;

    public FinancialQueryService(HabitusDbContext context)
    {
        _context = context;
    }

    public async Task<List<MonthlyFinancialBreakdownDto>> GetMonthlyBreakdownAsync(Guid condominiumId, int year)
    {
        var sql = @"
            SELECT 
                EXTRACT(MONTH FROM ""Date"")::int as month,
                COALESCE(SUM(CASE WHEN ""Type"" = 0 THEN ""Amount"" ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN ""Type"" = 1 THEN ""Amount"" ELSE 0 END), 0) as expenses
            FROM ""FinancialRecords""
            WHERE ""CondominiumId"" = {0} AND ""FiscalYear"" = {1} AND ""ReserveFundCategory"" IS NULL
            GROUP BY EXTRACT(MONTH FROM ""Date"")
            ORDER BY month";

        var results = await _context.Database.SqlQueryRaw<MonthlySqlResult>(sql, condominiumId, year).ToListAsync();

        // Fill in missing months with zeros
        var dict = results.ToDictionary(r => r.Month);
        var breakdown = new List<MonthlyFinancialBreakdownDto>();
        for (int month = 1; month <= 12; month++)
        {
            if (dict.TryGetValue(month, out var r))
            {
                breakdown.Add(new MonthlyFinancialBreakdownDto
                {
                    Month = month,
                    Income = r.Income,
                    Expenses = r.Expenses,
                    Balance = r.Income - r.Expenses
                });
            }
            else
            {
                breakdown.Add(new MonthlyFinancialBreakdownDto
                {
                    Month = month,
                    Income = 0,
                    Expenses = 0,
                    Balance = 0
                });
            }
        }
        return breakdown;
    }

    public async Task<List<CategoryTotalDto>> GetIncomeByCategoryAsync(Guid condominiumId, int year)
    {
        var sql = @"
            SELECT 
                COALESCE(""IncomeCategory""::text, 'Sem categoria') as category,
                COALESCE(SUM(""Amount""), 0) as total
            FROM ""FinancialRecords""
            WHERE ""CondominiumId"" = {0} AND ""FiscalYear"" = {1} AND ""Type"" = 0 AND ""ReserveFundCategory"" IS NULL
            GROUP BY ""IncomeCategory""
            ORDER BY total DESC";

        var results = await _context.Database.SqlQueryRaw<CategorySqlResult>(sql, condominiumId, year).ToListAsync();
        return results.Select(r => new CategoryTotalDto { Category = r.Category, Total = r.Total }).ToList();
    }

    public async Task<List<CategoryTotalDto>> GetExpensesByTagAsync(Guid condominiumId, int year)
    {
        // First get all expenses with their categories and hashtags
        var sql = @"
            SELECT 
                fr.""Amount"",
                EXTRACT(MONTH FROM fr.""Date"")::int as ""Month"",
                ec.""Hashtags""::text as ""HashtagsJson"",
                ec.""Name"" as ""CategoryName""
            FROM ""FinancialRecords"" fr
            LEFT JOIN ""ExpenseCategories"" ec ON fr.""ExpenseCategoryId"" = ec.""Id""
            WHERE fr.""CondominiumId"" = {0} AND fr.""FiscalYear"" = {1} AND fr.""Type"" = 1 AND fr.""ReserveFundCategory"" IS NULL";

        var expenses = await _context.Database.SqlQueryRaw<ExpenseDetailSqlResult>(sql, condominiumId, year).ToListAsync();

        // Process in memory (smaller dataset after SQL filtering)
        var groupedByTag = expenses
            .GroupBy(r =>
            {
                // Handle both JSON array format ["tag1", "tag2"] and comma-separated "tag1,tag2"
                List<string> hashtags;
                try
                {
                    var parsed = JsonSerializer.Deserialize<List<string>>(r.HashtagsJson ?? "[]");
                    hashtags = parsed ?? new List<string>();
                }
                catch (JsonException)
                {
                    // Fallback: comma-separated string
                    hashtags = (r.HashtagsJson ?? "")
                        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .ToList();
                }
                
                var firstHashtag = hashtags.FirstOrDefault();
                if (!string.IsNullOrEmpty(firstHashtag)) return firstHashtag;
                return string.IsNullOrWhiteSpace(r.CategoryName) ? "Sem categoria" : r.CategoryName;
            })
            .OrderByDescending(g => g.Sum(r => r.Amount))
            .Select(g => new CategoryTotalDto 
            { 
                Category = g.Key, 
                Total = g.Sum(r => r.Amount) 
            })
            .ToList();

        return groupedByTag;
    }

    public async Task<List<TagMonthlyBreakdownDto>> GetExpensesByTagMonthlyAsync(Guid condominiumId, int year)
    {
        var sql = @"
            SELECT 
                fr.""Amount"",
                EXTRACT(MONTH FROM fr.""Date"")::int as ""Month"",
                ec.""Hashtags""::text as ""HashtagsJson"",
                ec.""Name"" as ""CategoryName""
            FROM ""FinancialRecords"" fr
            LEFT JOIN ""ExpenseCategories"" ec ON fr.""ExpenseCategoryId"" = ec.""Id""
            WHERE fr.""CondominiumId"" = {0} AND fr.""FiscalYear"" = {1} AND fr.""Type"" = 1 AND fr.""ReserveFundCategory"" IS NULL";

        var expenses = await _context.Database.SqlQueryRaw<ExpenseDetailSqlResult>(sql, condominiumId, year).ToListAsync();

        // Process in memory
        var groupedByTag = expenses
            .GroupBy(r =>
            {
                // Handle both JSON array format ["tag1", "tag2"] and comma-separated "tag1,tag2"
                List<string> hashtags;
                try
                {
                    var parsed = JsonSerializer.Deserialize<List<string>>(r.HashtagsJson ?? "[]");
                    hashtags = parsed ?? new List<string>();
                }
                catch (JsonException)
                {
                    // Fallback: comma-separated string
                    hashtags = (r.HashtagsJson ?? "")
                        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .ToList();
                }
                
                var firstHashtag = hashtags.FirstOrDefault();
                if (!string.IsNullOrEmpty(firstHashtag)) return firstHashtag;
                return string.IsNullOrWhiteSpace(r.CategoryName) ? "Sem categoria" : r.CategoryName;
            })
            .OrderByDescending(g => g.Sum(r => r.Amount));

        var result = new List<TagMonthlyBreakdownDto>();

        foreach (var tagGroup in groupedByTag)
        {
            var tagName = tagGroup.Key;
            var tagTotal = tagGroup.Sum(r => r.Amount);

            var tagMonthlyValues = Enumerable.Range(1, 12)
                .Select(month => tagGroup.Where(r => r.Month == month).Sum(r => r.Amount))
                .ToList();

            result.Add(new TagMonthlyBreakdownDto
            {
                Tag = tagName,
                Category = null,
                IsTagGroup = true,
                MonthlyValues = tagMonthlyValues,
                Total = tagTotal
            });

            var groupedByCategory = tagGroup
                .GroupBy(r => string.IsNullOrWhiteSpace(r.CategoryName) ? "Sem categoria" : r.CategoryName)
                .OrderByDescending(g => g.Sum(r => r.Amount));

            foreach (var categoryGroup in groupedByCategory)
            {
                var categoryMonthlyValues = Enumerable.Range(1, 12)
                    .Select(month => categoryGroup.Where(r => r.Month == month).Sum(r => r.Amount))
                    .ToList();

                result.Add(new TagMonthlyBreakdownDto
                {
                    Tag = tagName,
                    Category = categoryGroup.Key,
                    IsTagGroup = false,
                    MonthlyValues = categoryMonthlyValues,
                    Total = categoryGroup.Sum(r => r.Amount)
                });
            }
        }

        return result;
    }

    private class MonthlySqlResult
    {
        public int Month { get; set; }
        public decimal Income { get; set; }
        public decimal Expenses { get; set; }
    }

    private class CategorySqlResult
    {
        public string Category { get; set; } = string.Empty;
        public decimal Total { get; set; }
    }

    private class ExpenseDetailSqlResult
    {
        public decimal Amount { get; set; }
        public int Month { get; set; }
        public string HashtagsJson { get; set; } = "[]";
        public string? CategoryName { get; set; }
    }
}
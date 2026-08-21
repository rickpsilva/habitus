using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Financial;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class FinancialServiceTests
{
    private readonly Mock<IRepository<FinancialRecord>> _repositoryMock;
    private readonly Mock<IFinancialQueryService> _financialQueryServiceMock;
    private readonly FinancialService _service;

    public FinancialServiceTests()
    {
        _repositoryMock = new Mock<IRepository<FinancialRecord>>();
        var reserveFundMock = new Mock<IRepository<ReserveFund>>();
        var announcementMock = new Mock<IRepository<Announcement>>();
        var expenseCategoryMock = new Mock<IRepository<ExpenseCategory>>();
        _financialQueryServiceMock = new Mock<IFinancialQueryService>();
        _service = new FinancialService(_repositoryMock.Object, reserveFundMock.Object, announcementMock.Object, expenseCategoryMock.Object, _financialQueryServiceMock.Object);
    }

    [Fact(Skip = "Legacy test - DTO fields updated. See FinancialServiceIsolationTests.")]
    public async Task CreateAsync_CreatesFinancialRecord()
    {
        await Task.CompletedTask; // body removed — legacy BuildingId field no longer exists
    }

    [Fact]
    public async Task GetSummaryAsync_ReturnsSummaryWithCorrectBalance()
    {
        var condominiumId = Guid.NewGuid();
        var records = new List<FinancialRecord>
        {
            new() { Id = Guid.NewGuid(), Type = FinancialType.Income, Amount = 5000m, CondominiumId = condominiumId, Date = DateTime.UtcNow, Description = "Fee", IncomeCategory = IncomeCategory.MonthlyFees },
            new() { Id = Guid.NewGuid(), Type = FinancialType.Expense, Amount = 2000m, CondominiumId = condominiumId, Date = DateTime.UtcNow, Description = "Repair", ExpenseCategoryId = Guid.NewGuid() }
        };
        _repositoryMock.Setup(r => r.FindWithIncludesAsync(
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync(records);

        var summary = await _service.GetSummaryAsync(condominiumId);

        summary.TotalIncome.Should().Be(5000m);
        summary.TotalExpense.Should().Be(2000m);
        summary.Balance.Should().Be(3000m);
    }

    [Fact]
    public async Task GetAnnualReportAsync_ReturnsTotalsMonthlyAndCategoryBreakdowns()
    {
        var condominiumId = Guid.NewGuid();
        const int year = 2026;

        // Mock the financial query service responses
        var monthlyBreakdown = new List<MonthlyFinancialBreakdownDto>
        {
            new() { Month = 1, Income = 1000m, Expenses = 300m, Balance = 700m },
            new() { Month = 2, Income = 0m, Expenses = 0m, Balance = 0m },
            new() { Month = 3, Income = 500m, Expenses = 200m, Balance = 300m },
            new() { Month = 4, Income = 0m, Expenses = 0m, Balance = 0m },
            new() { Month = 5, Income = 0m, Expenses = 0m, Balance = 0m },
            new() { Month = 6, Income = 0m, Expenses = 0m, Balance = 0m },
            new() { Month = 7, Income = 0m, Expenses = 0m, Balance = 0m },
            new() { Month = 8, Income = 0m, Expenses = 0m, Balance = 0m },
            new() { Month = 9, Income = 0m, Expenses = 0m, Balance = 0m },
            new() { Month = 10, Income = 0m, Expenses = 0m, Balance = 0m },
            new() { Month = 11, Income = 0m, Expenses = 0m, Balance = 0m },
            new() { Month = 12, Income = 0m, Expenses = 0m, Balance = 0m },
        };

        var incomeByCategory = new List<CategoryTotalDto>
        {
            new() { Category = "MonthlyFees", Total = 1000m },
            new() { Category = "ExtraordinaryFees", Total = 500m },
        };

        var expensesByTag = new List<CategoryTotalDto>
        {
            new() { Category = "limpeza", Total = 300m },
            new() { Category = "manutencao", Total = 200m },
        };

        var expensesByTagMonthly = new List<TagMonthlyBreakdownDto>
        {
            new() { Tag = "limpeza", Category = null, IsTagGroup = true, MonthlyValues = new List<decimal> { 300m, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 }, Total = 300m },
            new() { Tag = "limpeza", Category = "Limpeza", IsTagGroup = false, MonthlyValues = new List<decimal> { 300m, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 }, Total = 300m },
            new() { Tag = "manutencao", Category = null, IsTagGroup = true, MonthlyValues = new List<decimal> { 0, 0, 200m, 0, 0, 0, 0, 0, 0, 0, 0, 0 }, Total = 200m },
            new() { Tag = "manutencao", Category = "Manutenção", IsTagGroup = false, MonthlyValues = new List<decimal> { 0, 0, 200m, 0, 0, 0, 0, 0, 0, 0, 0, 0 }, Total = 200m },
        };

        _financialQueryServiceMock.Setup(s => s.GetMonthlyBreakdownAsync(condominiumId, year)).ReturnsAsync(monthlyBreakdown).Verifiable();
        _financialQueryServiceMock.Setup(s => s.GetIncomeByCategoryAsync(condominiumId, year)).ReturnsAsync(incomeByCategory).Verifiable();
        _financialQueryServiceMock.Setup(s => s.GetExpensesByTagAsync(condominiumId, year)).ReturnsAsync(expensesByTag).Verifiable();
        _financialQueryServiceMock.Setup(s => s.GetExpensesByTagMonthlyAsync(condominiumId, year)).ReturnsAsync(expensesByTagMonthly).Verifiable();

        var report = await _service.GetAnnualReportAsync(condominiumId, year);

        report.Year.Should().Be(year);
        report.TotalIncome.Should().Be(1500m);
        report.TotalExpenses.Should().Be(500m);
        report.Balance.Should().Be(1000m);
        report.MonthlyBreakdown.Should().HaveCount(12);
        report.MonthlyBreakdown.Single(m => m.Month == 1).Income.Should().Be(1000m);
        report.MonthlyBreakdown.Single(m => m.Month == 1).Expenses.Should().Be(300m);
        report.MonthlyBreakdown.Single(m => m.Month == 1).Balance.Should().Be(700m);
        report.MonthlyBreakdown.Single(m => m.Month == 3).Balance.Should().Be(300m);
        report.IncomeByCategory.Should().Contain(c => c.Category == "MonthlyFees" && c.Total == 1000m);
        report.IncomeByCategory.Should().Contain(c => c.Category == "ExtraordinaryFees" && c.Total == 500m);
        report.ExpensesByTag.Should().Contain(c => c.Category == "limpeza" && c.Total == 300m);
        report.ExpensesByTag.Should().Contain(c => c.Category == "manutencao" && c.Total == 200m);
        // Reserve fund movements are excluded from the report.
        report.ExpensesByTag.Sum(c => c.Total).Should().Be(500m);

        // Verify monthly breakdown by tag (now hierarchical: tag header + category rows)
        // Should have 4 rows: 2 tag headers + 2 category rows
        report.ExpensesByTagMonthly.Should().HaveCount(4);

        // limpeza tag header
        var limpezaHeader = report.ExpensesByTagMonthly.First(r => r.Tag == "limpeza" && r.IsTagGroup);
        limpezaHeader.Category.Should().BeNull();
        limpezaHeader.MonthlyValues.Should().HaveCount(12);
        limpezaHeader.MonthlyValues[0].Should().Be(300m); // January
        limpezaHeader.Total.Should().Be(300m);

        // limpeza category row
        var limpezaCategory = report.ExpensesByTagMonthly.First(r => r.Tag == "limpeza" && !r.IsTagGroup);
        limpezaCategory.Category.Should().Be("Limpeza");
        limpezaCategory.MonthlyValues[0].Should().Be(300m);

        // manutencao tag header
        var manutencaoHeader = report.ExpensesByTagMonthly.First(r => r.Tag == "manutencao" && r.IsTagGroup);
        manutencaoHeader.Category.Should().BeNull();
        manutencaoHeader.MonthlyValues[2].Should().Be(200m); // March
        manutencaoHeader.Total.Should().Be(200m);

        // manutencao category row
        var manutencaoCategory = report.ExpensesByTagMonthly.First(r => r.Tag == "manutencao" && !r.IsTagGroup);
        manutencaoCategory.Category.Should().Be("Manutenção");
    }

    [Fact]
    public async Task GetAnnualReportAsync_EmptyYear_ReturnsZeroedReport()
    {
        var condominiumId = Guid.NewGuid();
        const int year = 2030;

        var monthlyBreakdown = new List<MonthlyFinancialBreakdownDto>();
        for (int m = 1; m <= 12; m++)
        {
            monthlyBreakdown.Add(new MonthlyFinancialBreakdownDto { Month = m, Income = 0m, Expenses = 0m, Balance = 0m });
        }

        _financialQueryServiceMock.Setup(s => s.GetMonthlyBreakdownAsync(condominiumId, year)).ReturnsAsync(monthlyBreakdown);
        _financialQueryServiceMock.Setup(s => s.GetIncomeByCategoryAsync(condominiumId, year)).ReturnsAsync(new List<CategoryTotalDto>());
        _financialQueryServiceMock.Setup(s => s.GetExpensesByTagAsync(condominiumId, year)).ReturnsAsync(new List<CategoryTotalDto>());
        _financialQueryServiceMock.Setup(s => s.GetExpensesByTagMonthlyAsync(condominiumId, year)).ReturnsAsync(new List<TagMonthlyBreakdownDto>());

        var report = await _service.GetAnnualReportAsync(condominiumId, year);

        report.TotalIncome.Should().Be(0m);
        report.TotalExpenses.Should().Be(0m);
        report.Balance.Should().Be(0m);
        report.MonthlyBreakdown.Should().HaveCount(12);
        report.MonthlyBreakdown.Should().OnlyContain(m => m.Income == 0m && m.Expenses == 0m && m.Balance == 0m);
        report.IncomeByCategory.Should().BeEmpty();
        report.ExpensesByTag.Should().BeEmpty();
    }

    [Theory]
    [InlineData("Income", 1)]
    [InlineData("Expense", 1)]
    [InlineData(null, 2)]
    [InlineData("all", 2)]
    public async Task GetPagedByYearAsync_TypeFilter_ReturnsOnlyMatchingType(string? type, int expectedCount)
    {
        var condominiumId = Guid.NewGuid();
        var fiscalYear = DateTime.UtcNow.Year;
        var records = new List<FinancialRecord>
        {
            new() { Id = Guid.NewGuid(), Type = FinancialType.Income, Amount = 5000m, CondominiumId = condominiumId, Date = DateTime.UtcNow, FiscalYear = fiscalYear, Description = "Fee", IncomeCategory = IncomeCategory.MonthlyFees },
            new() { Id = Guid.NewGuid(), Type = FinancialType.Expense, Amount = 2000m, CondominiumId = condominiumId, Date = DateTime.UtcNow, FiscalYear = fiscalYear, Description = "Repair", ExpenseCategoryId = Guid.NewGuid() }
        };

        _repositoryMock
            .Setup(r => r.GetPagedWithIncludesAsync(
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<Expression<Func<FinancialRecord, object>>>(),
                It.IsAny<bool>(),
                It.IsAny<string[]>()))
            .ReturnsAsync((int page, int pageSize, Expression<Func<FinancialRecord, bool>> filter, Expression<Func<FinancialRecord, object>> orderBy, bool descending, string[] includes) =>
            {
                var filtered = records.Where(filter.Compile()).ToList();
                return new PaginatedResponse<FinancialRecord>
                {
                    Items = filtered,
                    Page = page,
                    PageSize = pageSize,
                    TotalItems = filtered.Count,
                    TotalPages = (int)Math.Ceiling(filtered.Count / (double)pageSize)
                };
            });

        var result = await _service.GetPagedByYearAsync(condominiumId, fiscalYear, 1, 10, null, type);

        result.TotalItems.Should().Be(expectedCount);
        result.Items.Should().HaveCount(expectedCount);
        if (type is "Income" or "Expense")
        {
            result.Items.Should().OnlyContain(i => i.Type == type);
        }
    }
}

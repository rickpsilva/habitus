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
    private readonly FinancialService _service;

    public FinancialServiceTests()
    {
        _repositoryMock = new Mock<IRepository<FinancialRecord>>();
        var reserveFundMock = new Mock<IRepository<ReserveFund>>();
        var announcementMock = new Mock<IRepository<Announcement>>();
        var expenseCategoryMock = new Mock<IRepository<ExpenseCategory>>();
        _service = new FinancialService(_repositoryMock.Object, reserveFundMock.Object, announcementMock.Object, expenseCategoryMock.Object);
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
        var records = new List<FinancialRecord>
        {
            new() { Id = Guid.NewGuid(), Type = FinancialType.Income, Amount = 1000m, CondominiumId = condominiumId, Date = new DateTime(year, 1, 10), FiscalYear = year, Description = "Fee Jan", IncomeCategory = IncomeCategory.MonthlyFees },
            new() { Id = Guid.NewGuid(), Type = FinancialType.Income, Amount = 500m, CondominiumId = condominiumId, Date = new DateTime(year, 3, 5), FiscalYear = year, Description = "Extra", IncomeCategory = IncomeCategory.ExtraordinaryFees },
            new() { Id = Guid.NewGuid(), Type = FinancialType.Expense, Amount = 300m, CondominiumId = condominiumId, Date = new DateTime(year, 1, 20), FiscalYear = year, Description = "Cleaning", ExpenseCategory = new ExpenseCategory { Name = "Limpeza", Hashtags = new List<string> { "limpeza" } } },
            new() { Id = Guid.NewGuid(), Type = FinancialType.Expense, Amount = 200m, CondominiumId = condominiumId, Date = new DateTime(year, 3, 15), FiscalYear = year, Description = "Elevator", ExpenseCategory = new ExpenseCategory { Name = "Manutenção", Hashtags = new List<string> { "manutencao" } } },
            new() { Id = Guid.NewGuid(), Type = FinancialType.Expense, Amount = 900m, CondominiumId = condominiumId, Date = new DateTime(year, 6, 1), FiscalYear = year, Description = "Reserve transfer", ReserveFundCategory = ReserveFundCategory.Transfer }
        };
        _repositoryMock.Setup(r => r.FindWithIncludesAsync(
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync((Expression<Func<FinancialRecord, bool>> filter, string[] _) => records.Where(filter.Compile()));

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
        _repositoryMock.Setup(r => r.FindWithIncludesAsync(
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync(Enumerable.Empty<FinancialRecord>());

        var report = await _service.GetAnnualReportAsync(condominiumId, 2030);

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
            .Setup(r => r.CountAsync(It.IsAny<Expression<Func<FinancialRecord, bool>>>()))
            .ReturnsAsync((Expression<Func<FinancialRecord, bool>> filter) => records.Count(filter.Compile()));

        _repositoryMock
            .Setup(r => r.FindWithIncludesAsync(
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync((Expression<Func<FinancialRecord, bool>> filter, string[] _) => records.Where(filter.Compile()));

        var result = await _service.GetPagedByYearAsync(condominiumId, fiscalYear, 1, 10, null, type);

        result.TotalItems.Should().Be(expectedCount);
        result.Items.Should().HaveCount(expectedCount);
        if (type is "Income" or "Expense")
        {
            result.Items.Should().OnlyContain(i => i.Type == type);
        }
    }
}

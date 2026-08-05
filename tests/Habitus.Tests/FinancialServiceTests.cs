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

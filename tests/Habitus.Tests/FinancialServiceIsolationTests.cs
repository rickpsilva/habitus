using FluentAssertions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Financial;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class FinancialServiceIsolationTests
{
    private readonly Mock<IRepository<FinancialRecord>> _repositoryMock;
    private readonly Mock<IFinancialQueryService> _financialQueryServiceMock;
    private readonly FinancialService _service;

    private readonly Guid _condominiumA = Guid.NewGuid();
    private readonly Guid _condominiumB = Guid.NewGuid();

    public FinancialServiceIsolationTests()
    {
        _repositoryMock = new Mock<IRepository<FinancialRecord>>();
        var reserveFundMock = new Mock<IRepository<ReserveFund>>();
        var announcementMock = new Mock<IRepository<Announcement>>();
        var expenseCategoryMock = new Mock<IRepository<ExpenseCategory>>();
        _financialQueryServiceMock = new Mock<IFinancialQueryService>();
        _service = new FinancialService(_repositoryMock.Object, reserveFundMock.Object, announcementMock.Object, expenseCategoryMock.Object, _financialQueryServiceMock.Object);
    }

    [Fact]
    public async Task GetAllAsync_OnlyReturnsOwnCondominiumRecords()
    {
        var records = new List<FinancialRecord>
        {
            new() { Id = Guid.NewGuid(), CondominiumId = _condominiumA, Description = "A Record", Type = FinancialType.Income, Amount = 100, Date = DateTime.UtcNow, FiscalYear = DateTime.UtcNow.Year, IncomeCategory = IncomeCategory.MonthlyFees },
            new() { Id = Guid.NewGuid(), CondominiumId = _condominiumB, Description = "B Record", Type = FinancialType.Expense, Amount = 50, Date = DateTime.UtcNow, FiscalYear = DateTime.UtcNow.Year, ExpenseCategoryId = Guid.NewGuid() },
        };
        _repositoryMock.Setup(r => r.FindWithIncludesAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync((System.Linq.Expressions.Expression<Func<FinancialRecord, bool>> predicate, string[] _) =>
                records.Where(predicate.Compile()).ToList());

        var result = (await _service.GetAllAsync(_condominiumA)).ToList();

        result.Should().HaveCount(1);
        result[0].Description.Should().Be("A Record");
    }

    [Fact]
    public async Task GetPagedAsync_OnlyReturnsOwnCondominiumRecords()
    {
        var records = new List<FinancialRecord>
        {
            new() { Id = Guid.NewGuid(), CondominiumId = _condominiumA, Description = "A Record", Type = FinancialType.Income, Amount = 100, Date = DateTime.UtcNow, FiscalYear = DateTime.UtcNow.Year, IncomeCategory = IncomeCategory.MonthlyFees },
            new() { Id = Guid.NewGuid(), CondominiumId = _condominiumB, Description = "B Record", Type = FinancialType.Expense, Amount = 50, Date = DateTime.UtcNow, FiscalYear = DateTime.UtcNow.Year, ExpenseCategoryId = Guid.NewGuid() },
        };

        _repositoryMock
            .Setup(r => r.GetPagedWithIncludesAsync(
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<System.Linq.Expressions.Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<System.Linq.Expressions.Expression<Func<FinancialRecord, object>>>(),
                It.IsAny<bool>(),
                It.IsAny<string[]>()))
            .Returns((int page, int pageSize, System.Linq.Expressions.Expression<Func<FinancialRecord, bool>> filter, System.Linq.Expressions.Expression<Func<FinancialRecord, object>> orderBy, bool descending, string[] includes) =>
            {
                var filtered = records.Where(filter.Compile()).OrderByDescending(orderBy.Compile()).ToList();
                var totalItems = filtered.Count;
                var items = filtered.Skip((page - 1) * pageSize).Take(pageSize).ToList();
                return Task.FromResult(new PaginatedResponse<FinancialRecord>
                {
                    Items = items,
                    Page = page,
                    PageSize = pageSize,
                    TotalItems = totalItems,
                    TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
                });
            });

        var result = await _service.GetPagedAsync(1, 10, _condominiumA);

        result.Items.Should().HaveCount(1);
        result.Items.First().Description.Should().Be("A Record");
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNullForOtherCondominium()
    {
        var id = Guid.NewGuid();
        var record = new FinancialRecord { Id = id, CondominiumId = _condominiumB, Description = "B Record", Type = FinancialType.Expense, Amount = 50, Date = DateTime.UtcNow, FiscalYear = DateTime.UtcNow.Year, ExpenseCategoryId = Guid.NewGuid() };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(record);

        var result = await _service.GetByIdAsync(id, _condominiumA);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsRecordForOwnCondominium()
    {
        var id = Guid.NewGuid();
        var record = new FinancialRecord { Id = id, CondominiumId = _condominiumA, Description = "A Record", Type = FinancialType.Income, Amount = 100, Date = DateTime.UtcNow, FiscalYear = DateTime.UtcNow.Year, IncomeCategory = IncomeCategory.MonthlyFees };
        _repositoryMock.Setup(r => r.GetByIdWithIncludesAsync(id, It.IsAny<string[]>())).ReturnsAsync(record);

        var result = await _service.GetByIdAsync(id, _condominiumA);

        result.Should().NotBeNull();
        result!.Description.Should().Be("A Record");
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalseForOtherCondominium()
    {
        var id = Guid.NewGuid();
        var record = new FinancialRecord { Id = id, CondominiumId = _condominiumB, Description = "B Record", Type = FinancialType.Expense, Amount = 50, Date = DateTime.UtcNow, FiscalYear = DateTime.UtcNow.Year, ExpenseCategoryId = Guid.NewGuid() };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(record);

        var result = await _service.DeleteAsync(id, _condominiumA);

        result.Should().BeFalse();
        _repositoryMock.Verify(r => r.Remove(It.IsAny<FinancialRecord>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_ReturnsTrueForOwnCondominium()
    {
        var id = Guid.NewGuid();
        var record = new FinancialRecord { Id = id, CondominiumId = _condominiumA, Description = "A Record", Type = FinancialType.Income, Amount = 100, Date = DateTime.UtcNow, FiscalYear = DateTime.UtcNow.Year, IncomeCategory = IncomeCategory.MonthlyFees };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(record);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await _service.DeleteAsync(id, _condominiumA);

        result.Should().BeTrue();
        _repositoryMock.Verify(r => r.Remove(record), Times.Once);
    }
}

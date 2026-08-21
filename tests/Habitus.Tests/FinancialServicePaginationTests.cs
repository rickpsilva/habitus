using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class FinancialServicePaginationTests
{
    private readonly Mock<IRepository<FinancialRecord>> _repositoryMock;
    private readonly Mock<IFinancialQueryService> _financialQueryServiceMock;
    private readonly FinancialService _service;

    public FinancialServicePaginationTests()
    {
        _repositoryMock = new Mock<IRepository<FinancialRecord>>();
        var reserveFundMock = new Mock<IRepository<ReserveFund>>();
        var announcementMock = new Mock<IRepository<Announcement>>();
        var expenseCategoryMock = new Mock<IRepository<ExpenseCategory>>();
        _financialQueryServiceMock = new Mock<IFinancialQueryService>();
        _service = new FinancialService(_repositoryMock.Object, reserveFundMock.Object, announcementMock.Object, expenseCategoryMock.Object, _financialQueryServiceMock.Object);
    }

    private static FinancialRecord Record(Guid condominiumId, string description, IncomeCategory incomeCategory = IncomeCategory.MonthlyFees)
        => new()
        {
            Id = Guid.NewGuid(),
            Type = FinancialType.Income,
            Amount = 100m,
            Description = description,
            Date = DateTime.UtcNow,
            FiscalYear = DateTime.UtcNow.Year,
            IncomeCategory = incomeCategory,
            CondominiumId = condominiumId
        };

    [Fact]
    public async Task GetPagedAsync_MapsEntitiesToDtos_AndForwardsMetadata()
    {
        var condominiumId = Guid.NewGuid();
        var baseDate = DateTime.UtcNow.Date;
        var entities = Enumerable.Range(0, 8)
            .Select(i => new FinancialRecord
            {
                Id = Guid.NewGuid(),
                Type = FinancialType.Income,
                Amount = 100m,
                Description = i == 7 ? "Water bill" : $"Record {i}",
                Date = baseDate.AddHours(-i),
                FiscalYear = baseDate.Year,
                IncomeCategory = IncomeCategory.MonthlyFees,
                CondominiumId = condominiumId
            })
            .ToList();

        var expectedPagedResponse = new PaginatedResponse<FinancialRecord>
        {
            Items = entities.Skip(5).Take(5).ToList(), // page 2, size 5
            Page = 2,
            PageSize = 5,
            TotalItems = 8,
            TotalPages = 2
        };

        _repositoryMock
            .Setup(r => r.GetPagedWithIncludesAsync(
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<Expression<Func<FinancialRecord, object>>>(),
                It.IsAny<bool>(),
                It.IsAny<string[]>()))
            .ReturnsAsync(expectedPagedResponse);

        var result = await _service.GetPagedAsync(page: 2, pageSize: 5, condominiumId: condominiumId);

        result.Items.Should().ContainSingle(dto => dto.Description == "Water bill");
        result.Page.Should().Be(2);
        result.PageSize.Should().Be(5);
        result.TotalItems.Should().Be(8);
        result.TotalPages.Should().Be(2);
    }

    [Fact]
    public async Task GetPagedAsync_ScopesFilterToCondominium()
    {
        var condominiumId = Guid.NewGuid();
        var otherCondominiumId = Guid.NewGuid();
        Expression<Func<FinancialRecord, bool>>? capturedFilter = null;
        
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
                capturedFilter = filter;
                return new PaginatedResponse<FinancialRecord>
                {
                    Items = new List<FinancialRecord>(),
                    Page = 1,
                    PageSize = 10,
                    TotalItems = 0,
                    TotalPages = 0
                };
            });

        await _service.GetPagedAsync(page: 1, pageSize: 10, condominiumId: condominiumId);

        capturedFilter.Should().NotBeNull();
        var predicate = capturedFilter!.Compile();
        predicate(Record(condominiumId, "Own record")).Should().BeTrue();
        predicate(Record(otherCondominiumId, "Foreign record")).Should().BeFalse();
    }

    [Fact]
    public async Task GetPagedAsync_NormalizesInvalidPagingArguments()
    {
        var condominiumId = Guid.NewGuid();
        
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
                return new PaginatedResponse<FinancialRecord>
                {
                    Items = new List<FinancialRecord>(),
                    Page = Math.Max(1, page),
                    PageSize = Math.Clamp(pageSize, 1, 100),
                    TotalItems = 0,
                    TotalPages = 0
                };
            });

        var result = await _service.GetPagedAsync(page: 0, pageSize: 999, condominiumId: condominiumId);

        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
        result.TotalItems.Should().Be(0);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPagedAsync_SearchFilterMatchesDescriptionWithinCondominium()
    {
        var condominiumId = Guid.NewGuid();
        Expression<Func<FinancialRecord, bool>>? capturedFilter = null;
        
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
                capturedFilter = filter;
                return new PaginatedResponse<FinancialRecord>
                {
                    Items = new List<FinancialRecord>(),
                    Page = 1,
                    PageSize = 10,
                    TotalItems = 0,
                    TotalPages = 0
                };
            });

        await _service.GetPagedAsync(page: 1, pageSize: 10, condominiumId: condominiumId, search: "WATER");

        var predicate = capturedFilter!.Compile();
        predicate(Record(condominiumId, "Water bill")).Should().BeTrue();
        predicate(Record(condominiumId, "Elevator maintenance")).Should().BeFalse();
    }
}

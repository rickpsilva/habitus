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
    private readonly FinancialService _service;

    public FinancialServicePaginationTests()
    {
        _repositoryMock = new Mock<IRepository<FinancialRecord>>();
        var reserveFundMock = new Mock<IRepository<ReserveFund>>();
        var announcementMock = new Mock<IRepository<Announcement>>();
        _service = new FinancialService(_repositoryMock.Object, reserveFundMock.Object, announcementMock.Object);
    }

    private static FinancialRecord Record(Guid condominiumId, string description, FinancialCategory category = FinancialCategory.MonthlyFees)
        => new()
        {
            Id = Guid.NewGuid(),
            Type = FinancialType.Income,
            Amount = 100m,
            Description = description,
            Date = DateTime.UtcNow,
            FiscalYear = DateTime.UtcNow.Year,
            Category = category,
            CondominiumId = condominiumId
        };

    [Fact]
    public async Task GetPagedAsync_MapsEntitiesToDtos_AndForwardsMetadata()
    {
        var condominiumId = Guid.NewGuid();
        var entities = new List<FinancialRecord> { Record(condominiumId, "Water bill") };
        _repositoryMock
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<Expression<Func<FinancialRecord, object>>>(),
                It.IsAny<bool>()))
            .ReturnsAsync(new PaginatedResponse<FinancialRecord>
            {
                Items = entities,
                Page = 2,
                PageSize = 5,
                TotalItems = 8,
                TotalPages = 2
            });

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
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<Expression<Func<FinancialRecord, object>>>(),
                It.IsAny<bool>()))
            .Callback<int, int, Expression<Func<FinancialRecord, bool>>, Expression<Func<FinancialRecord, object>>, bool>(
                (_, _, filter, _, _) => capturedFilter = filter)
            .ReturnsAsync(new PaginatedResponse<FinancialRecord>());

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
        var capturedPage = -1;
        var capturedPageSize = -1;
        _repositoryMock
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<Expression<Func<FinancialRecord, object>>>(),
                It.IsAny<bool>()))
            .Callback<int, int, Expression<Func<FinancialRecord, bool>>, Expression<Func<FinancialRecord, object>>, bool>(
                (page, pageSize, _, _, _) =>
                {
                    capturedPage = page;
                    capturedPageSize = pageSize;
                })
            .ReturnsAsync(new PaginatedResponse<FinancialRecord>());

        await _service.GetPagedAsync(page: 0, pageSize: 999, condominiumId: condominiumId);

        capturedPage.Should().Be(1);
        capturedPageSize.Should().Be(10);
    }

    [Fact]
    public async Task GetPagedAsync_SearchFilterMatchesDescriptionWithinCondominium()
    {
        var condominiumId = Guid.NewGuid();
        Expression<Func<FinancialRecord, bool>>? capturedFilter = null;
        _repositoryMock
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<FinancialRecord, bool>>>(),
                It.IsAny<Expression<Func<FinancialRecord, object>>>(),
                It.IsAny<bool>()))
            .Callback<int, int, Expression<Func<FinancialRecord, bool>>, Expression<Func<FinancialRecord, object>>, bool>(
                (_, _, filter, _, _) => capturedFilter = filter)
            .ReturnsAsync(new PaginatedResponse<FinancialRecord>());

        await _service.GetPagedAsync(page: 1, pageSize: 10, condominiumId: condominiumId, search: "WATER");

        var predicate = capturedFilter!.Compile();
        predicate(Record(condominiumId, "Water bill")).Should().BeTrue();
        predicate(Record(condominiumId, "Elevator maintenance")).Should().BeFalse();
    }
}

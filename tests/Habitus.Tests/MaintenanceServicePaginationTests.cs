using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class MaintenanceServicePaginationTests
{
    private readonly Mock<IRepository<MaintenanceRequest>> _repositoryMock = new();
    private readonly MaintenanceService _service;

    public MaintenanceServicePaginationTests()
    {
        _service = new MaintenanceService(
            _repositoryMock.Object,
            new Mock<IRepository<Notification>>().Object,
            new Mock<IRepository<FinancialRecord>>().Object,
            new Mock<IRepository<ExpenseCategory>>().Object,
            new Mock<INotificationDispatchService>().Object);
    }

    private static MaintenanceRequest Request(Guid condominiumId, Guid createdBy, Guid unitId, string title = "Broken lift")
        => new()
        {
            Id = Guid.NewGuid(),
            Title = title,
            CondominiumId = condominiumId,
            CreatedBy = createdBy,
            UnitId = unitId,
            CreatedAt = DateTime.UtcNow
        };

    private void SetupCapture(Action<int, int, Expression<Func<MaintenanceRequest, bool>>> capture,
        PaginatedResponse<MaintenanceRequest>? response = null)
    {
        _repositoryMock
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<MaintenanceRequest, bool>>>(),
                It.IsAny<Expression<Func<MaintenanceRequest, object>>>(),
                It.IsAny<bool>()))
            .Callback<int, int, Expression<Func<MaintenanceRequest, bool>>, Expression<Func<MaintenanceRequest, object>>, bool>(
                (page, pageSize, filter, _, _) => capture(page, pageSize, filter))
            .ReturnsAsync(response ?? new PaginatedResponse<MaintenanceRequest>());
    }

    [Fact]
    public async Task GetPagedAsync_Admin_ScopesToCondominium()
    {
        var condo = Guid.NewGuid();
        var other = Guid.NewGuid();
        Expression<Func<MaintenanceRequest, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedAsync(1, 10, condo, "Admin", Guid.NewGuid(), unitId: null);

        var predicate = captured!.Compile();
        predicate(Request(condo, Guid.NewGuid(), Guid.NewGuid())).Should().BeTrue();
        predicate(Request(other, Guid.NewGuid(), Guid.NewGuid())).Should().BeFalse();
    }

    [Fact]
    public async Task GetPagedAsync_Resident_SeesAllRequestsWithinCondominium()
    {
        var condo = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        Expression<Func<MaintenanceRequest, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedAsync(1, 10, condo, "Resident", userId, unitId);

        var predicate = captured!.Compile();
        predicate(Request(condo, userId, Guid.NewGuid())).Should().BeTrue();          // own request
        predicate(Request(condo, Guid.NewGuid(), unitId)).Should().BeTrue();          // request on own unit
        predicate(Request(condo, Guid.NewGuid(), Guid.NewGuid())).Should().BeTrue();  // another resident's request in same condo
        predicate(Request(Guid.NewGuid(), userId, unitId)).Should().BeFalse();        // other condominium
    }

    [Fact]
    public async Task GetPagedAsync_NonAdminNonResident_ReturnsEmptyWithoutQuerying()
    {
        var result = await _service.GetPagedAsync(1, 10, Guid.NewGuid(), "Manager", Guid.NewGuid(), null);

        result.TotalItems.Should().Be(0);
        result.Items.Should().BeEmpty();
        _repositoryMock.Verify(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
            It.IsAny<Expression<Func<MaintenanceRequest, bool>>>(),
            It.IsAny<Expression<Func<MaintenanceRequest, object>>>(),
            It.IsAny<bool>()), Times.Never);
    }

    [Fact]
    public async Task GetPagedAsync_ForwardsMetadata_AndNormalizesArguments()
    {
        var condo = Guid.NewGuid();
        var capturedPage = 0;
        var capturedPageSize = 0;
        SetupCapture((page, pageSize, _) => { capturedPage = page; capturedPageSize = pageSize; },
            new PaginatedResponse<MaintenanceRequest>
            {
                Items = new List<MaintenanceRequest> { Request(condo, Guid.NewGuid(), Guid.NewGuid()) },
                Page = 1,
                PageSize = 10,
                TotalItems = 1,
                TotalPages = 1
            });

        var result = await _service.GetPagedAsync(0, 999, condo, "Admin", Guid.NewGuid(), null);

        capturedPage.Should().Be(1);
        capturedPageSize.Should().Be(10);
        result.Items.Should().ContainSingle(dto => dto.Title == "Broken lift");
    }

    private static MaintenanceRequest Request(Guid condominiumId, MaintenanceStatus status)
        => new()
        {
            Id = Guid.NewGuid(),
            Title = "Broken lift",
            CondominiumId = condominiumId,
            CreatedBy = Guid.NewGuid(),
            UnitId = Guid.NewGuid(),
            Status = status,
            CreatedAt = DateTime.UtcNow
        };

    [Theory]
    [InlineData("Open", MaintenanceStatus.Open, true)]
    [InlineData("Open", MaintenanceStatus.InProgress, false)]
    [InlineData("InProgress", MaintenanceStatus.InProgress, true)]
    [InlineData("InProgress", MaintenanceStatus.Completed, false)]
    public async Task GetPagedAsync_StatusFilter_AppliesExactStatus(string status, MaintenanceStatus rowStatus, bool expected)
    {
        var condo = Guid.NewGuid();
        Expression<Func<MaintenanceRequest, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedAsync(1, 10, condo, "Admin", Guid.NewGuid(), null, status: status);

        var predicate = captured!.Compile();
        predicate(Request(condo, rowStatus)).Should().Be(expected);
    }

    [Theory]
    [InlineData("Completed")]
    [InlineData("Resolved")]
    [InlineData("Closed")]
    public async Task GetPagedAsync_CompletedStatusFilter_MatchesCompletedAndClosed(string status)
    {
        var condo = Guid.NewGuid();
        Expression<Func<MaintenanceRequest, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedAsync(1, 10, condo, "Admin", Guid.NewGuid(), null, status: status);

        var predicate = captured!.Compile();
        predicate(Request(condo, MaintenanceStatus.Completed)).Should().BeTrue();
        predicate(Request(condo, MaintenanceStatus.Closed)).Should().BeTrue();
        predicate(Request(condo, MaintenanceStatus.Open)).Should().BeFalse();
        predicate(Request(condo, MaintenanceStatus.InProgress)).Should().BeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("All")]
    public async Task GetPagedAsync_NoStatusFilter_MatchesEveryStatus(string? status)
    {
        var condo = Guid.NewGuid();
        Expression<Func<MaintenanceRequest, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedAsync(1, 10, condo, "Admin", Guid.NewGuid(), null, status: status);

        var predicate = captured!.Compile();
        predicate(Request(condo, MaintenanceStatus.Open)).Should().BeTrue();
        predicate(Request(condo, MaintenanceStatus.InProgress)).Should().BeTrue();
        predicate(Request(condo, MaintenanceStatus.Completed)).Should().BeTrue();
        predicate(Request(condo, MaintenanceStatus.Closed)).Should().BeTrue();
    }

    [Fact]
    public async Task GetStatusCountsAsync_Admin_CountsScopedByCondominiumWithClosedCollapsed()
    {
        var condo = Guid.NewGuid();
        var other = Guid.NewGuid();
        var rows = new List<MaintenanceRequest>
        {
            Request(condo, MaintenanceStatus.Open),
            Request(condo, MaintenanceStatus.Open),
            Request(condo, MaintenanceStatus.InProgress),
            Request(condo, MaintenanceStatus.Completed),
            Request(condo, MaintenanceStatus.Closed),
            Request(other, MaintenanceStatus.Open),        // different condominium — excluded
            Request(other, MaintenanceStatus.Completed),   // different condominium — excluded
        };
        _repositoryMock
            .Setup(r => r.CountAsync(It.IsAny<Expression<Func<MaintenanceRequest, bool>>>()))
            .ReturnsAsync((Expression<Func<MaintenanceRequest, bool>> predicate) => rows.Count(predicate.Compile()));

        var counts = await _service.GetStatusCountsAsync(condo, "Admin", Guid.NewGuid(), null);

        counts.Open.Should().Be(2);
        counts.InProgress.Should().Be(1);
        counts.Completed.Should().Be(2); // Completed + Closed collapsed
    }

    [Fact]
    public async Task GetStatusCountsAsync_NonAdminNonResident_ReturnsZerosWithoutQuerying()
    {
        var counts = await _service.GetStatusCountsAsync(Guid.NewGuid(), "Manager", Guid.NewGuid(), null);

        counts.Open.Should().Be(0);
        counts.InProgress.Should().Be(0);
        counts.Completed.Should().Be(0);
        _repositoryMock.Verify(r => r.CountAsync(It.IsAny<Expression<Func<MaintenanceRequest, bool>>>()), Times.Never);
    }
}

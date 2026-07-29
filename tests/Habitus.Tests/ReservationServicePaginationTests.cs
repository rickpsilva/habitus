using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class ReservationServicePaginationTests
{
    private readonly Mock<IRepository<Reservation>> _repositoryMock = new();
    private readonly ReservationService _service;

    public ReservationServicePaginationTests()
    {
        _service = new ReservationService(
            _repositoryMock.Object,
            new Mock<IRepository<SharedSpace>>().Object,
            new Mock<IRepository<User>>().Object,
            new Mock<IRepository<FinancialRecord>>().Object,
            new Mock<IRepository<Notification>>().Object,
            new Mock<INotificationDispatchService>().Object);
    }

    private static Reservation Reservation(Guid condominiumId, string? adminComments = null)
        => new()
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            SpaceId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            StartTime = DateTime.UtcNow,
            EndTime = DateTime.UtcNow.AddHours(1),
            AdminComments = adminComments
        };

    private void SetupCapture(Action<int, int, Expression<Func<Reservation, bool>>> capture,
        PaginatedResponse<Reservation>? response = null)
    {
        _repositoryMock
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<Reservation, bool>>>(),
                It.IsAny<Expression<Func<Reservation, object>>>(),
                It.IsAny<bool>()))
            .Callback<int, int, Expression<Func<Reservation, bool>>, Expression<Func<Reservation, object>>, bool>(
                (page, pageSize, filter, _, _) => capture(page, pageSize, filter))
            .ReturnsAsync(response ?? new PaginatedResponse<Reservation>());
    }

    [Fact]
    public async Task GetPagedAsync_ScopesFilterToCondominium()
    {
        var condo = Guid.NewGuid();
        var other = Guid.NewGuid();
        Expression<Func<Reservation, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedAsync(1, 10, condo);

        var predicate = captured!.Compile();
        predicate(Reservation(condo)).Should().BeTrue();
        predicate(Reservation(other)).Should().BeFalse();
    }

    [Fact]
    public async Task GetPagedAsync_SearchMatchesAdminCommentsWithinCondominium()
    {
        var condo = Guid.NewGuid();
        Expression<Func<Reservation, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedAsync(1, 10, condo, search: "Approved");

        var predicate = captured!.Compile();
        predicate(Reservation(condo, "Approved by manager")).Should().BeTrue();
        predicate(Reservation(condo, "Rejected")).Should().BeFalse();
        predicate(Reservation(condo, adminComments: null)).Should().BeFalse();
    }

    [Fact]
    public async Task GetPagedAsync_ForwardsMetadata_AndNormalizesArguments()
    {
        var condo = Guid.NewGuid();
        var capturedPage = 0;
        var capturedPageSize = 0;
        SetupCapture((page, pageSize, _) => { capturedPage = page; capturedPageSize = pageSize; },
            new PaginatedResponse<Reservation>
            {
                Items = new List<Reservation> { Reservation(condo) },
                Page = 1,
                PageSize = 10,
                TotalItems = 3,
                TotalPages = 1
            });

        var result = await _service.GetPagedAsync(0, 999, condo);

        capturedPage.Should().Be(1);
        capturedPageSize.Should().Be(10);
        result.TotalItems.Should().Be(3);
        result.Items.Should().ContainSingle();
    }
}

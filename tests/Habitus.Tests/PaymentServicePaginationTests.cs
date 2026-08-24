using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class PaymentServicePaginationTests
{
    private readonly Mock<IRepository<Payment>> _paymentRepositoryMock = new();
    private readonly PaymentService _service;

    public PaymentServicePaginationTests()
    {
        _service = new PaymentService(
            _paymentRepositoryMock.Object,
            new Mock<IRepository<FinancialRecord>>().Object,
            new Mock<IRepository<Notification>>().Object,
            new Mock<IRepository<User>>().Object,
            new Mock<IRepository<Unit>>().Object,
            new Mock<INotificationDispatchService>().Object);
    }

    private static Payment Payment(Guid condominiumId)
        => new()
        {
            Id = Guid.NewGuid(),
            ResidentId = Guid.NewGuid(),
            UnitId = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Type = PaymentType.MonthlyFee,
            Method = PaymentMethod.BankTransfer,
            Amount = 50m,
            Status = PaymentStatus.Pending,
            CreatedDate = DateTime.UtcNow
        };

    private static Payment Payment(Guid condominiumId, Guid residentId, PaymentStatus status, string description = "Quota")
        => new()
        {
            Id = Guid.NewGuid(),
            ResidentId = residentId,
            UnitId = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Type = PaymentType.MonthlyFee,
            Method = PaymentMethod.BankTransfer,
            Amount = 50m,
            Description = description,
            Status = status,
            CreatedDate = DateTime.UtcNow
        };

    private void SetupCapture(Action<int, int, Expression<Func<Payment, bool>>> capture,
        PaginatedResponse<Payment>? response = null)
    {
        _paymentRepositoryMock
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<Payment, bool>>>(),
                It.IsAny<Expression<Func<Payment, object>>>(),
                It.IsAny<bool>()))
            .Callback<int, int, Expression<Func<Payment, bool>>, Expression<Func<Payment, object>>, bool>(
                (page, pageSize, filter, _, _) => capture(page, pageSize, filter))
            .ReturnsAsync(response ?? new PaginatedResponse<Payment>());
    }

    [Fact]
    public async Task GetPagedAsync_ScopesFilterToCondominium()
    {
        var condo = Guid.NewGuid();
        var other = Guid.NewGuid();
        Expression<Func<Payment, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedAsync(condo, 1, 10);

        var predicate = captured!.Compile();
        predicate(Payment(condo)).Should().BeTrue();
        predicate(Payment(other)).Should().BeFalse();
    }

    [Fact]
    public async Task GetPagedAsync_ForwardsMetadata_AndNormalizesArguments()
    {
        var condo = Guid.NewGuid();
        var capturedPage = 0;
        var capturedPageSize = 0;
        SetupCapture((page, pageSize, _) => { capturedPage = page; capturedPageSize = pageSize; },
            new PaginatedResponse<Payment>
            {
                Items = new List<Payment> { Payment(condo) },
                Page = 1,
                PageSize = 10,
                TotalItems = 7,
                TotalPages = 1
            });

        var result = await _service.GetPagedAsync(condo, 0, 999);

        capturedPage.Should().Be(1);
        capturedPageSize.Should().Be(10);
        result.TotalItems.Should().Be(7);
        result.Items.Should().ContainSingle();
    }

    [Fact]
    public async Task GetPagedByResidentAsync_ScopesToResidentAndCondominium()
    {
        var condo = Guid.NewGuid();
        var otherCondo = Guid.NewGuid();
        var resident = Guid.NewGuid();
        var otherResident = Guid.NewGuid();
        Expression<Func<Payment, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedByResidentAsync(resident, condo, 1, 10, status: null, search: null);

        var predicate = captured!.Compile();
        predicate(Payment(condo, resident, PaymentStatus.Pending)).Should().BeTrue();
        predicate(Payment(condo, otherResident, PaymentStatus.Pending)).Should().BeFalse();   // another resident
        predicate(Payment(otherCondo, resident, PaymentStatus.Pending)).Should().BeFalse();    // another condominium
    }

    [Theory]
    [InlineData("Pending", PaymentStatus.Pending, true)]
    [InlineData("Pending", PaymentStatus.Approved, false)]
    [InlineData("approved", PaymentStatus.Approved, true)]
    [InlineData("Rejected", PaymentStatus.Rejected, true)]
    [InlineData("Cancelled", PaymentStatus.Cancelled, true)]
    public async Task GetPagedByResidentAsync_StatusFilter_AppliesServerSide(string status, PaymentStatus rowStatus, bool expected)
    {
        var condo = Guid.NewGuid();
        var resident = Guid.NewGuid();
        Expression<Func<Payment, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedByResidentAsync(resident, condo, 1, 10, status, search: null);

        var predicate = captured!.Compile();
        predicate(Payment(condo, resident, rowStatus)).Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("All")]
    public async Task GetPagedByResidentAsync_NoStatusFilter_MatchesEveryStatus(string? status)
    {
        var condo = Guid.NewGuid();
        var resident = Guid.NewGuid();
        Expression<Func<Payment, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedByResidentAsync(resident, condo, 1, 10, status, search: null);

        var predicate = captured!.Compile();
        predicate(Payment(condo, resident, PaymentStatus.Pending)).Should().BeTrue();
        predicate(Payment(condo, resident, PaymentStatus.Approved)).Should().BeTrue();
        predicate(Payment(condo, resident, PaymentStatus.Rejected)).Should().BeTrue();
        predicate(Payment(condo, resident, PaymentStatus.Cancelled)).Should().BeTrue();
    }

    [Fact]
    public async Task GetPagedByResidentAsync_Search_MatchesDescriptionCaseInsensitive()
    {
        var condo = Guid.NewGuid();
        var resident = Guid.NewGuid();
        Expression<Func<Payment, bool>>? captured = null;
        SetupCapture((_, _, filter) => captured = filter);

        await _service.GetPagedByResidentAsync(resident, condo, 1, 10, status: null, search: "QUOTA");

        var predicate = captured!.Compile();
        predicate(Payment(condo, resident, PaymentStatus.Pending, "Quota mensal")).Should().BeTrue();
        predicate(Payment(condo, resident, PaymentStatus.Pending, "Reserva salão")).Should().BeFalse();
    }

    [Fact]
    public async Task GetResidentStatusCountsAsync_TalliesByStatusScopedToResidentAndCondominium()
    {
        var condo = Guid.NewGuid();
        var otherCondo = Guid.NewGuid();
        var resident = Guid.NewGuid();
        var otherResident = Guid.NewGuid();
        var rows = new List<Payment>
        {
            Payment(condo, resident, PaymentStatus.Pending),
            Payment(condo, resident, PaymentStatus.Pending),
            Payment(condo, resident, PaymentStatus.Approved),
            Payment(condo, resident, PaymentStatus.Rejected),
            Payment(condo, resident, PaymentStatus.Cancelled),
            Payment(condo, otherResident, PaymentStatus.Pending),  // another resident — excluded
            Payment(otherCondo, resident, PaymentStatus.Approved),  // another condominium — excluded
        };
        _paymentRepositoryMock
            .Setup(r => r.CountAsync(It.IsAny<Expression<Func<Payment, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Expression<Func<Payment, bool>> predicate, CancellationToken _) => rows.Count(predicate.Compile()));

        var counts = await _service.GetResidentStatusCountsAsync(resident, condo);

        counts.All.Should().Be(5);
        counts.Pending.Should().Be(2);
        counts.Approved.Should().Be(1);
        counts.Rejected.Should().Be(1);
        counts.Cancelled.Should().Be(1);
    }
}

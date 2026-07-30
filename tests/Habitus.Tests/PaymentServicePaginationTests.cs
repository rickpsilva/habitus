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
}

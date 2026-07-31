using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class PaymentServiceMappingTests
{
    private readonly Mock<IRepository<Payment>> _paymentRepositoryMock = new();
    private readonly Mock<IRepository<User>> _userRepositoryMock = new();
    private readonly Mock<IRepository<Unit>> _unitRepositoryMock = new();
    private readonly PaymentService _service;

    public PaymentServiceMappingTests()
    {
        _service = new PaymentService(
            _paymentRepositoryMock.Object,
            new Mock<IRepository<FinancialRecord>>().Object,
            new Mock<IRepository<Notification>>().Object,
            _userRepositoryMock.Object,
            _unitRepositoryMock.Object,
            new Mock<INotificationDispatchService>().Object);
    }

    [Fact]
    public async Task GetPagedAsync_MapsRelatedEntitiesForWholePage()
    {
        var condo = Guid.NewGuid();

        var residentA = Guid.NewGuid();
        var residentB = Guid.NewGuid();
        var unitA = Guid.NewGuid();
        var unitB = Guid.NewGuid();
        var processedBy = Guid.NewGuid();
        var receiptIssuedBy = Guid.NewGuid();

        var payment1 = new Payment
        {
            Id = Guid.NewGuid(),
            ResidentId = residentA,
            UnitId = unitA,
            CondominiumId = condo,
            Type = PaymentType.MonthlyFee,
            Method = PaymentMethod.BankTransfer,
            Amount = 75m,
            Description = "Quota Jan",
            Status = PaymentStatus.Approved,
            CreatedDate = DateTime.UtcNow,
            ProcessedByUserId = processedBy,
            ReceiptNumber = 12,
            ReceiptYear = 2026,
            ReceiptIssuedByUserId = receiptIssuedBy
        };
        var payment2 = new Payment
        {
            Id = Guid.NewGuid(),
            ResidentId = residentB,
            UnitId = unitB,
            CondominiumId = condo,
            Type = PaymentType.Other,
            Method = PaymentMethod.MBWay,
            Amount = 30m,
            Description = "Extra",
            Status = PaymentStatus.Pending,
            CreatedDate = DateTime.UtcNow
        };

        var users = new List<User>
        {
            new() { Id = residentA, Name = "Alice Resident" },
            new() { Id = residentB, Name = "Bob Resident" },
            new() { Id = processedBy, Name = "Carol Admin" },
            new() { Id = receiptIssuedBy, Name = "Dave Admin" },
        };
        var units = new List<Unit>
        {
            new() { Id = unitA, Number = "A-101" },
            new() { Id = unitB, Number = "B-202" },
        };

        _paymentRepositoryMock
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<Payment, bool>>>(),
                It.IsAny<Expression<Func<Payment, object>>>(),
                It.IsAny<bool>()))
            .ReturnsAsync(new PaginatedResponse<Payment>
            {
                Items = new List<Payment> { payment1, payment2 },
                Page = 1,
                PageSize = 10,
                TotalItems = 2,
                TotalPages = 1
            });

        _userRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync(users);
        _unitRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Unit, bool>>>()))
            .ReturnsAsync(units);

        var result = await _service.GetPagedAsync(condo, 1, 10);

        // Related entities are loaded once per table, not per payment.
        _userRepositoryMock.Verify(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>()), Times.Once);
        _unitRepositoryMock.Verify(r => r.FindAsync(It.IsAny<Expression<Func<Unit, bool>>>()), Times.Once);
        _userRepositoryMock.Verify(r => r.GetByIdAsync(It.IsAny<Guid>()), Times.Never);
        _unitRepositoryMock.Verify(r => r.GetByIdAsync(It.IsAny<Guid>()), Times.Never);

        var dto1 = result.Items.Single(d => d.Id == payment1.Id);
        dto1.ResidentName.Should().Be("Alice Resident");
        dto1.UnitIdentifier.Should().Be("A-101");
        dto1.ProcessedByUserName.Should().Be("Carol Admin");
        dto1.ReceiptIssuedByUserName.Should().Be("Dave Admin");
        dto1.ReceiptNumber.Should().Be(12);
        dto1.ReceiptYear.Should().Be(2026);
        dto1.Status.Should().Be("Approved");

        var dto2 = result.Items.Single(d => d.Id == payment2.Id);
        dto2.ResidentName.Should().Be("Bob Resident");
        dto2.UnitIdentifier.Should().Be("B-202");
        dto2.ProcessedByUserName.Should().BeNull();
        dto2.ReceiptIssuedByUserName.Should().BeNull();
    }
}

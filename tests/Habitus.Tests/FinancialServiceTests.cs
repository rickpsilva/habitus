using System.Linq.Expressions;
using FluentAssertions;
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
        _service = new FinancialService(_repositoryMock.Object);
    }

    [Fact]
    public async Task CreateAsync_CreatesFinancialRecord()
    {
        var request = new CreateFinancialRecordRequest
        {
            Type = "Income",
            Amount = 1000m,
            Description = "Monthly fee",
            Date = DateTime.UtcNow,
            Category = "Maintenance",
            BuildingId = Guid.NewGuid()
        };
        _repositoryMock.Setup(r => r.AddAsync(It.IsAny<FinancialRecord>())).Returns(Task.CompletedTask);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await _service.CreateAsync(request);

        result.Should().NotBeNull();
        result.Amount.Should().Be(1000m);
        result.Type.Should().Be("Income");
    }

    [Fact]
    public async Task GetSummaryAsync_ReturnsSummaryWithCorrectBalance()
    {
        var buildingId = Guid.NewGuid();
        var records = new List<FinancialRecord>
        {
            new() { Id = Guid.NewGuid(), Type = FinancialType.Income, Amount = 5000m, BuildingId = buildingId, Date = DateTime.UtcNow, Description = "Fee", Category = "Fee" },
            new() { Id = Guid.NewGuid(), Type = FinancialType.Expense, Amount = 2000m, BuildingId = buildingId, Date = DateTime.UtcNow, Description = "Repair", Category = "Repair" }
        };
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<FinancialRecord, bool>>>()))
            .ReturnsAsync(records);

        var summary = await _service.GetSummaryAsync(buildingId);

        summary.TotalIncome.Should().Be(5000m);
        summary.TotalExpense.Should().Be(2000m);
        summary.Balance.Should().Be(3000m);
    }
}

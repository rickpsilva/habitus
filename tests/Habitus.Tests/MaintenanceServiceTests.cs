using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Maintenance;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class MaintenanceServiceTests
{
    private readonly Mock<IRepository<MaintenanceRequest>> _repositoryMock;
    private readonly Mock<IRepository<FinancialRecord>> _financialRepositoryMock;
    private readonly Mock<IRepository<ExpenseCategory>> _expenseCategoryRepositoryMock;
    private readonly MaintenanceService _service;

    public MaintenanceServiceTests()
    {
        _repositoryMock = new Mock<IRepository<MaintenanceRequest>>();
        var notificationRepoMock = new Mock<IRepository<Notification>>();
        _financialRepositoryMock = new Mock<IRepository<FinancialRecord>>();
        _expenseCategoryRepositoryMock = new Mock<IRepository<ExpenseCategory>>();
        var dispatchMock = new Mock<INotificationDispatchService>();
        _service = new MaintenanceService(_repositoryMock.Object, notificationRepoMock.Object, _financialRepositoryMock.Object, _expenseCategoryRepositoryMock.Object, dispatchMock.Object);
    }

    [Fact]
    public async Task CreateAsync_CreatesRequestWithOpenStatus()
    {
        var request = new CreateMaintenanceRequest
        {
            Title = "Broken pipe",
            Description = "Leak in bathroom",
            Priority = "High",
            CondominiumId = Guid.NewGuid(),
            UnitId = Guid.NewGuid(),
            CreatedBy = Guid.NewGuid(),
            Location = "Bathroom"
        };
        _repositoryMock.Setup(r => r.AddAsync(It.IsAny<MaintenanceRequest>())).Returns(Task.CompletedTask);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await _service.CreateAsync(request);

        result.Should().NotBeNull();
        result.Status.Should().Be("Open");
        result.Title.Should().Be("Broken pipe");
        result.Priority.Should().Be("High");
    }

    [Fact]
    public async Task UpdateAsync_WhenCompleted_SetsResolvedAt()
    {
        var id = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var entity = new MaintenanceRequest { Id = id, Status = MaintenanceStatus.Open, CondominiumId = condominiumId };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(entity);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await _service.UpdateAsync(id, new UpdateMaintenanceRequest { Status = "Completed" }, condominiumId, "Admin", Guid.NewGuid(), null);

        result.Should().NotBeNull();
        result!.Status.Should().Be("Completed");
        entity.ResolvedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateAsync_WhenUsingLegacyResolvedStatus_NormalizesToCompleted()
    {
        var id = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var entity = new MaintenanceRequest { Id = id, Status = MaintenanceStatus.Open, CondominiumId = condominiumId };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(entity);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await _service.UpdateAsync(id, new UpdateMaintenanceRequest { Status = "Resolved" }, condominiumId, "Admin", Guid.NewGuid(), null);

        result.Should().NotBeNull();
        result!.Status.Should().Be("Completed");
        entity.Status.Should().Be(MaintenanceStatus.Completed);
    }

    [Fact]
    public async Task UpdateStatusAsync_WhenCompletedWithoutInvoice_AllowsStatusUpdate()
    {
        var id = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var expenseCategoryId = Guid.NewGuid();
        var entity = new MaintenanceRequest
        {
            Id = id,
            Status = MaintenanceStatus.InProgress,
            Title = "Leak",
            CondominiumId = condominiumId,
            UnitId = unitId,
            CreatedBy = userId
        };

        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(entity);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _financialRepositoryMock.Setup(r => r.AddAsync(It.IsAny<FinancialRecord>())).Returns(Task.CompletedTask);
        _financialRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _expenseCategoryRepositoryMock.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExpenseCategory, bool>>>()))
            .ReturnsAsync((Expression<Func<ExpenseCategory, bool>> predicate) =>
                new ExpenseCategory
                {
                    Id = expenseCategoryId,
                    CondominiumId = condominiumId,
                    Name = "Repairs",
                    IsActive = true,
                    IsDeleted = false
                });

        var result = await _service.UpdateStatusAsync(
            id,
            new UpdateMaintenanceStatusRequest
            {
                Status = "Completed",
                ExpenseAmount = 120.50m,
                ExpenseCategoryId = expenseCategoryId
            },
            condominiumId,
            "Admin",
            userId,
            unitId);

        result.Should().NotBeNull();
        result!.Status.Should().Be("Completed");
        entity.Status.Should().Be(MaintenanceStatus.Completed);
        entity.InvoiceDocumentId.Should().BeNull();
        entity.HasExpense.Should().BeTrue();
        entity.ExpenseAmount.Should().Be(120.50m);
        entity.ExpenseCategoryId.Should().Be(expenseCategoryId);
    }

    [Fact]
    public async Task UpdateStatusAsync_WhenInProgressToOpen_Throws()
    {
        var id = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var entity = new MaintenanceRequest
        {
            Id = id,
            Status = MaintenanceStatus.InProgress,
            CondominiumId = condominiumId,
            UnitId = unitId,
            CreatedBy = userId
        };

        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(entity);

        var act = () => _service.UpdateStatusAsync(
            id,
            new UpdateMaintenanceStatusRequest { Status = "Open" },
            condominiumId,
            "Admin",
            userId,
            unitId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*não pode voltar ao estado Aberto*");
    }

    [Fact]
    public async Task UpdateStatusAsync_WhenCompletedToInProgress_Throws()
    {
        var id = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var entity = new MaintenanceRequest
        {
            Id = id,
            Status = MaintenanceStatus.Completed,
            CondominiumId = condominiumId,
            UnitId = unitId,
            CreatedBy = userId
        };

        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(entity);

        var act = () => _service.UpdateStatusAsync(
            id,
            new UpdateMaintenanceStatusRequest { Status = "InProgress" },
            condominiumId,
            "Admin",
            userId,
            unitId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*concluída não pode voltar a outros estados*");
    }

    [Fact]
    public async Task UpdateAsync_WhenNotFound_ReturnsNull()
    {
        _repositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((MaintenanceRequest?)null);

        var result = await _service.UpdateAsync(Guid.NewGuid(), new UpdateMaintenanceRequest(), Guid.NewGuid(), "Admin", Guid.NewGuid(), null);

        result.Should().BeNull();
    }
}

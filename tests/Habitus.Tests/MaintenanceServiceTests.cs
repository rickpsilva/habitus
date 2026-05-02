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
    private readonly MaintenanceService _service;

    public MaintenanceServiceTests()
    {
        _repositoryMock = new Mock<IRepository<MaintenanceRequest>>();
        var notificationRepoMock = new Mock<IRepository<Notification>>();
        var financialRepoMock = new Mock<IRepository<FinancialRecord>>();
        var dispatchMock = new Mock<INotificationDispatchService>();
        _service = new MaintenanceService(_repositoryMock.Object, notificationRepoMock.Object, financialRepoMock.Object, dispatchMock.Object);
    }

    [Fact]
    public async Task CreateAsync_CreatesRequestWithOpenStatus()
    {
        var request = new CreateMaintenanceRequest
        {
            Title = "Broken pipe",
            Description = "Leak in bathroom",
            Priority = "High",
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
    public async Task UpdateAsync_WhenResolved_SetsResolvedAt()
    {
        var id = Guid.NewGuid();
        var entity = new MaintenanceRequest { Id = id, Status = MaintenanceStatus.Open };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(entity);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await _service.UpdateAsync(id, new UpdateMaintenanceRequest { Status = "Resolved" });

        result.Should().NotBeNull();
        result!.Status.Should().Be("Resolved");
        entity.ResolvedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateAsync_WhenNotFound_ReturnsNull()
    {
        _repositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((MaintenanceRequest?)null);

        var result = await _service.UpdateAsync(Guid.NewGuid(), new UpdateMaintenanceRequest());

        result.Should().BeNull();
    }
}

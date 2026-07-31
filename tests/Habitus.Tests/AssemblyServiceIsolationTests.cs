using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class AssemblyServiceIsolationTests
{
    private readonly Mock<IRepository<Assembly>> _repositoryMock;
    private readonly AssemblyService _service;

    private readonly Guid _condominiumA = Guid.NewGuid();
    private readonly Guid _condominiumB = Guid.NewGuid();

    public AssemblyServiceIsolationTests()
    {
        _repositoryMock = new Mock<IRepository<Assembly>>();
        var notificationRepoMock = new Mock<IRepository<Notification>>();
        var dispatchMock = new Mock<INotificationDispatchService>();
        _service = new AssemblyService(_repositoryMock.Object, notificationRepoMock.Object, dispatchMock.Object);
    }

    private void SetupFind(List<Assembly> source) =>
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Assembly, bool>>>()))
            .ReturnsAsync((Expression<Func<Assembly, bool>> predicate) =>
                source.Where(predicate.Compile()).ToList());

    [Fact]
    public async Task GetAllAsync_Admin_OnlyReturnsOwnCondominiumAssemblies()
    {
        var assemblies = new List<Assembly>
        {
            new() { Id = Guid.NewGuid(), Title = "A Assembly", CondominiumId = _condominiumA, ScheduledAt = DateTime.UtcNow.AddDays(1), Status = AssemblyStatus.Scheduled },
            new() { Id = Guid.NewGuid(), Title = "B Assembly", CondominiumId = _condominiumB, ScheduledAt = DateTime.UtcNow.AddDays(1), Status = AssemblyStatus.Scheduled },
        };
        SetupFind(assemblies);

        var result = (await _service.GetAllAsync(_condominiumA, "Admin")).ToList();

        result.Should().HaveCount(1);
        result[0].Title.Should().Be("A Assembly");
    }

    [Fact]
    public async Task GetAllAsync_Resident_OnlyReturnsOwnCondominiumAssemblies()
    {
        var assemblies = new List<Assembly>
        {
            new() { Id = Guid.NewGuid(), Title = "A Assembly", CondominiumId = _condominiumA, ScheduledAt = DateTime.UtcNow.AddDays(1), Status = AssemblyStatus.Scheduled },
            new() { Id = Guid.NewGuid(), Title = "B Assembly", CondominiumId = _condominiumB, ScheduledAt = DateTime.UtcNow.AddDays(1), Status = AssemblyStatus.Scheduled },
        };
        SetupFind(assemblies);

        var result = (await _service.GetAllAsync(_condominiumA, "Resident")).ToList();

        result.Should().HaveCount(1);
        result[0].Title.Should().Be("A Assembly");
    }

    [Fact]
    public async Task GetByIdAsync_Admin_ReturnsNullForOtherCondominium()
    {
        var id = Guid.NewGuid();
        var assembly = new Assembly { Id = id, Title = "B Assembly", CondominiumId = _condominiumB, ScheduledAt = DateTime.UtcNow.AddDays(1), Status = AssemblyStatus.Scheduled };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(assembly);

        var result = await _service.GetByIdAsync(id, _condominiumA, "Admin");

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_Admin_ReturnsAssemblyForOwnCondominium()
    {
        var id = Guid.NewGuid();
        var assembly = new Assembly { Id = id, Title = "A Assembly", CondominiumId = _condominiumA, ScheduledAt = DateTime.UtcNow.AddDays(1), Status = AssemblyStatus.Scheduled };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(assembly);

        var result = await _service.GetByIdAsync(id, _condominiumA, "Admin");

        result.Should().NotBeNull();
        result!.Title.Should().Be("A Assembly");
    }

    [Fact]
    public async Task DeleteAsync_Admin_ReturnsFalseForOtherCondominium()
    {
        var id = Guid.NewGuid();
        var assembly = new Assembly { Id = id, CondominiumId = _condominiumB, ScheduledAt = DateTime.UtcNow.AddDays(1) };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(assembly);

        var result = await _service.DeleteAsync(id, _condominiumA, "Admin");

        result.Should().BeFalse();
        _repositoryMock.Verify(r => r.Remove(It.IsAny<Assembly>()), Times.Never);
    }

    [Fact]
    public async Task GetPagedAsync_Admin_OnlyReturnsOwnCondominiumAssemblies()
    {
        var assemblies = new List<Assembly>
        {
            new() { Id = Guid.NewGuid(), Title = "A Assembly", CondominiumId = _condominiumA, ScheduledAt = DateTime.UtcNow.AddDays(1), Status = AssemblyStatus.Scheduled },
            new() { Id = Guid.NewGuid(), Title = "B Assembly", CondominiumId = _condominiumB, ScheduledAt = DateTime.UtcNow.AddDays(1), Status = AssemblyStatus.Scheduled },
        };
        SetupFind(assemblies);

        var result = await _service.GetPagedAsync(1, 10, _condominiumA, "Admin");

        result.Items.Should().HaveCount(1);
        result.Items.First().Title.Should().Be("A Assembly");
    }

    [Fact]
    public async Task GetAllAsync_PastDueScheduledAssembly_AutoUpdatesToInProgress()
    {
        var pastDueA = new Assembly { Id = Guid.NewGuid(), Title = "Past-due A", CondominiumId = _condominiumA, ScheduledAt = DateTime.UtcNow.AddHours(-1), Status = AssemblyStatus.Scheduled };
        var futureB = new Assembly { Id = Guid.NewGuid(), Title = "Future B", CondominiumId = _condominiumB, ScheduledAt = DateTime.UtcNow.AddHours(-1), Status = AssemblyStatus.Scheduled };
        SetupFind(new List<Assembly> { pastDueA, futureB });

        var result = (await _service.GetAllAsync(_condominiumA, "Admin")).ToList();

        result.Should().ContainSingle();
        pastDueA.Status.Should().Be(AssemblyStatus.InProgress);
        futureB.Status.Should().Be(AssemblyStatus.Scheduled);
        _repositoryMock.Verify(r => r.Update(pastDueA), Times.Once);
        _repositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task GetAllAsync_NonAdminNonResidentRole_ReturnsEmptyAndSkipsDatabase()
    {
        var assemblies = new List<Assembly>
        {
            new() { Id = Guid.NewGuid(), Title = "A Assembly", CondominiumId = _condominiumA, ScheduledAt = DateTime.UtcNow.AddDays(1), Status = AssemblyStatus.Scheduled },
        };
        SetupFind(assemblies);

        var result = (await _service.GetAllAsync(_condominiumA, "Manager")).ToList();

        result.Should().BeEmpty();
        _repositoryMock.Verify(r => r.FindAsync(It.IsAny<Expression<Func<Assembly, bool>>>()), Times.Never);
    }
}

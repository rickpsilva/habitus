using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Maintenance;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class MaintenanceServiceIsolationTests
{
    private readonly Mock<IRepository<MaintenanceRequest>> _repositoryMock;
    private readonly MaintenanceService _service;

    private readonly Guid _condominiumA = Guid.NewGuid();
    private readonly Guid _condominiumB = Guid.NewGuid();
    private readonly Guid _adminUserId = Guid.NewGuid();
    private readonly Guid _residentUserId = Guid.NewGuid();
    private readonly Guid _unitId = Guid.NewGuid();

    public MaintenanceServiceIsolationTests()
    {
        _repositoryMock = new Mock<IRepository<MaintenanceRequest>>();
        var notificationRepoMock = new Mock<IRepository<Notification>>();
        var financialRepoMock = new Mock<IRepository<FinancialRecord>>();
        var dispatchMock = new Mock<INotificationDispatchService>();
        _service = new MaintenanceService(
            _repositoryMock.Object,
            notificationRepoMock.Object,
            financialRepoMock.Object,
            dispatchMock.Object);
    }

    private void SetupFind(List<MaintenanceRequest> source) =>
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MaintenanceRequest, bool>>>()))
            .ReturnsAsync((Expression<Func<MaintenanceRequest, bool>> predicate) =>
                source.Where(predicate.Compile()).ToList());

    [Fact]
    public async Task GetAllAsync_Admin_OnlyReturnsOwnCondominiumRequests()
    {
        var requests = new List<MaintenanceRequest>
        {
            new() { Id = Guid.NewGuid(), Title = "A Request", CondominiumId = _condominiumA, UnitId = _unitId, CreatedBy = _residentUserId },
            new() { Id = Guid.NewGuid(), Title = "B Request", CondominiumId = _condominiumB, UnitId = Guid.NewGuid(), CreatedBy = Guid.NewGuid() },
        };
        SetupFind(requests);

        var result = (await _service.GetAllAsync(_condominiumA, "Admin", _adminUserId, null)).ToList();

        result.Should().HaveCount(1);
        result[0].Title.Should().Be("A Request");
    }

    [Fact]
    public async Task GetAllAsync_Resident_SeesAllRequestsWithinOwnCondominiumButNotOthers()
    {
        var request1 = new MaintenanceRequest { Id = Guid.NewGuid(), Title = "Own Request", CondominiumId = _condominiumA, UnitId = _unitId, CreatedBy = _residentUserId };
        var request2 = new MaintenanceRequest { Id = Guid.NewGuid(), Title = "Other Resident Request", CondominiumId = _condominiumA, UnitId = Guid.NewGuid(), CreatedBy = Guid.NewGuid() };
        var request3 = new MaintenanceRequest { Id = Guid.NewGuid(), Title = "Other Condo Request", CondominiumId = _condominiumB, UnitId = _unitId, CreatedBy = _residentUserId };
        SetupFind(new List<MaintenanceRequest> { request1, request2, request3 });

        var result = (await _service.GetAllAsync(_condominiumA, "Resident", _residentUserId, _unitId)).ToList();

        result.Should().HaveCount(2);
        result.Should().Contain(r => r.Title == "Own Request");
        result.Should().Contain(r => r.Title == "Other Resident Request");
        result.Should().NotContain(r => r.Title == "Other Condo Request");
    }

    [Fact]
    public async Task GetByIdAsync_Resident_CanViewAnotherResidentsRequestInSameCondominium()
    {
        var id = Guid.NewGuid();
        var request = new MaintenanceRequest { Id = id, Title = "Building lift", CondominiumId = _condominiumA, UnitId = Guid.NewGuid(), CreatedBy = Guid.NewGuid() };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(request);

        var result = await _service.GetByIdAsync(id, _condominiumA, "Resident", _residentUserId, _unitId);

        result.Should().NotBeNull();
        result!.Title.Should().Be("Building lift");
    }

    [Fact]
    public async Task GetByIdAsync_Admin_ReturnsNullForOtherCondominium()
    {
        var id = Guid.NewGuid();
        var request = new MaintenanceRequest { Id = id, CondominiumId = _condominiumB, UnitId = _unitId, CreatedBy = _residentUserId };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(request);

        var result = await _service.GetByIdAsync(id, _condominiumA, "Admin", _adminUserId, null);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetAllAsync_Admin_SeesAllRequestsWithinOwnCondominium()
    {
        var requests = new List<MaintenanceRequest>
        {
            new() { Id = Guid.NewGuid(), Title = "Request 1", CondominiumId = _condominiumA, UnitId = _unitId, CreatedBy = _residentUserId },
            new() { Id = Guid.NewGuid(), Title = "Request 2", CondominiumId = _condominiumA, UnitId = Guid.NewGuid(), CreatedBy = Guid.NewGuid() },
        };
        SetupFind(requests);

        var result = (await _service.GetAllAsync(_condominiumA, "Admin", _adminUserId, null)).ToList();

        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllAsync_NonAdminNonResidentRole_ReturnsEmptyAndSkipsDatabase()
    {
        var requests = new List<MaintenanceRequest>
        {
            new() { Id = Guid.NewGuid(), Title = "A Request", CondominiumId = _condominiumA, UnitId = _unitId, CreatedBy = _residentUserId },
        };
        SetupFind(requests);

        var result = (await _service.GetAllAsync(_condominiumA, "Manager", _adminUserId, null)).ToList();

        result.Should().BeEmpty();
        _repositoryMock.Verify(r => r.FindAsync(It.IsAny<Expression<Func<MaintenanceRequest, bool>>>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_Admin_ReturnsFalseForOtherCondominium()
    {
        var id = Guid.NewGuid();
        var request = new MaintenanceRequest { Id = id, CondominiumId = _condominiumB, UnitId = _unitId, CreatedBy = _residentUserId };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(request);

        var result = await _service.DeleteAsync(id, _condominiumA, "Admin", _adminUserId, null);

        result.Should().BeFalse();
        _repositoryMock.Verify(r => r.Remove(It.IsAny<MaintenanceRequest>()), Times.Never);
    }
}

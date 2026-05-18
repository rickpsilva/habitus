using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Reservations;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class ReservationServiceIsolationTests
{
    private readonly Mock<IRepository<Reservation>> _repositoryMock;
    private readonly Mock<IRepository<SharedSpace>> _spaceRepositoryMock;
    private readonly Mock<IRepository<User>> _userRepositoryMock;
    private readonly Mock<IRepository<FinancialRecord>> _financialRepositoryMock;
    private readonly Mock<IRepository<Notification>> _notificationRepositoryMock;
    private readonly Mock<INotificationDispatchService> _notificationDispatchServiceMock;
    private readonly ReservationService _service;

    private readonly Guid _condominiumA = Guid.NewGuid();
    private readonly Guid _condominiumB = Guid.NewGuid();

    public ReservationServiceIsolationTests()
    {
        _repositoryMock = new Mock<IRepository<Reservation>>();
        _spaceRepositoryMock = new Mock<IRepository<SharedSpace>>();
        _userRepositoryMock = new Mock<IRepository<User>>();
        _financialRepositoryMock = new Mock<IRepository<FinancialRecord>>();
        _notificationRepositoryMock = new Mock<IRepository<Notification>>();
        _notificationDispatchServiceMock = new Mock<INotificationDispatchService>();
        _service = new ReservationService(
            _repositoryMock.Object,
            _spaceRepositoryMock.Object,
            _userRepositoryMock.Object,
            _financialRepositoryMock.Object,
            _notificationRepositoryMock.Object,
            _notificationDispatchServiceMock.Object);
    }

    [Fact]
    public async Task GetAllAsync_OnlyReturnsOwnCondominiumReservations()
    {
        var reservations = new List<Reservation>
        {
            new() { Id = Guid.NewGuid(), CondominiumId = _condominiumA, SpaceId = Guid.NewGuid(), UserId = Guid.NewGuid(), StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1) },
            new() { Id = Guid.NewGuid(), CondominiumId = _condominiumB, SpaceId = Guid.NewGuid(), UserId = Guid.NewGuid(), StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1) },
        };
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Reservation, bool>>>()))
            .ReturnsAsync((Expression<Func<Reservation, bool>> predicate) =>
                reservations.Where(predicate.Compile()).ToList());

        var result = (await _service.GetAllAsync(_condominiumA)).ToList();

        result.Should().HaveCount(1);
        result[0].CondominiumId.Should().Be(_condominiumA);
    }

    [Fact]
    public async Task GetPagedAsync_OnlyReturnsOwnCondominiumReservations()
    {
        var reservations = new List<Reservation>
        {
            new() { Id = Guid.NewGuid(), CondominiumId = _condominiumA, SpaceId = Guid.NewGuid(), UserId = Guid.NewGuid(), StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1) },
            new() { Id = Guid.NewGuid(), CondominiumId = _condominiumB, SpaceId = Guid.NewGuid(), UserId = Guid.NewGuid(), StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1) },
        };
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Reservation, bool>>>()))
            .ReturnsAsync((Expression<Func<Reservation, bool>> predicate) =>
                reservations.Where(predicate.Compile()).ToList());

        var result = await _service.GetPagedAsync(1, 10, _condominiumA);

        result.Items.Should().HaveCount(1);
        result.Items.First().CondominiumId.Should().Be(_condominiumA);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNullForOtherCondominium()
    {
        var id = Guid.NewGuid();
        var reservation = new Reservation { Id = id, CondominiumId = _condominiumB, SpaceId = Guid.NewGuid(), UserId = Guid.NewGuid(), StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1) };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(reservation);

        var result = await _service.GetByIdAsync(id, _condominiumA);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsReservationForOwnCondominium()
    {
        var id = Guid.NewGuid();
        var reservation = new Reservation { Id = id, CondominiumId = _condominiumA, SpaceId = Guid.NewGuid(), UserId = Guid.NewGuid(), StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1) };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(reservation);

        var result = await _service.GetByIdAsync(id, _condominiumA);

        result.Should().NotBeNull();
        result!.CondominiumId.Should().Be(_condominiumA);
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalseForOtherCondominium()
    {
        var id = Guid.NewGuid();
        var reservation = new Reservation { Id = id, CondominiumId = _condominiumB, SpaceId = Guid.NewGuid(), UserId = Guid.NewGuid(), StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1) };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(reservation);

        var result = await _service.DeleteAsync(id, _condominiumA);

        result.Should().BeFalse();
        _repositoryMock.Verify(r => r.Remove(It.IsAny<Reservation>()), Times.Never);
    }

    [Fact]
    public async Task ApproveAsync_ReturnsErrorForOtherCondominium()
    {
        var id = Guid.NewGuid();
        var reservation = new Reservation { Id = id, CondominiumId = _condominiumB, SpaceId = Guid.NewGuid(), UserId = Guid.NewGuid(), StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1), Status = ReservationStatus.Pending };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(reservation);

        var (dto, error) = await _service.ApproveAsync(id, new ChangeReservationStatusRequest(), _condominiumA);

        dto.Should().BeNull();
        error.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenSharedSpaceIsFromAnotherCondominium()
    {
        var request = new CreateReservationRequest
        {
            SpaceId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            StartTime = DateTime.UtcNow.AddHours(2),
            EndTime = DateTime.UtcNow.AddHours(3)
        };

        _spaceRepositoryMock
            .Setup(r => r.GetByIdAsync(request.SpaceId))
            .ReturnsAsync(new SharedSpace
            {
                Id = request.SpaceId,
                CondominiumId = _condominiumB,
                Name = "Piscina"
            });

        var (dto, error) = await _service.CreateAsync(request, _condominiumA);

        dto.Should().BeNull();
        error.Should().Be("Espaço comum não encontrado.");
        _repositoryMock.Verify(r => r.AddAsync(It.IsAny<Reservation>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsError_WhenTargetSpaceIsFromAnotherCondominium()
    {
        var reservationId = Guid.NewGuid();
        var request = new UpdateReservationRequest
        {
            SpaceId = Guid.NewGuid(),
            StartTime = DateTime.UtcNow.AddHours(2),
            EndTime = DateTime.UtcNow.AddHours(4)
        };

        _repositoryMock
            .Setup(r => r.GetByIdAsync(reservationId))
            .ReturnsAsync(new Reservation
            {
                Id = reservationId,
                CondominiumId = _condominiumA,
                SpaceId = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                StartTime = DateTime.UtcNow.AddHours(1),
                EndTime = DateTime.UtcNow.AddHours(2),
                Status = ReservationStatus.Pending
            });

        _spaceRepositoryMock
            .Setup(r => r.GetByIdAsync(request.SpaceId))
            .ReturnsAsync(new SharedSpace
            {
                Id = request.SpaceId,
                CondominiumId = _condominiumB,
                Name = "Sala Comum"
            });

        var (dto, error) = await _service.UpdateAsync(reservationId, request, _condominiumA);

        dto.Should().BeNull();
        error.Should().Be("Espaço comum não encontrado.");
        _repositoryMock.Verify(r => r.Update(It.IsAny<Reservation>()), Times.Never);
    }
}

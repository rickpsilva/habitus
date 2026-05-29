using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Reservations;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class ReservationServiceTests
{
    private readonly Mock<IRepository<Reservation>> _repositoryMock;
    private readonly Mock<IRepository<SharedSpace>> _spaceRepoMock;
    private readonly Mock<IRepository<User>> _userRepoMock;
    private readonly Mock<IRepository<FinancialRecord>> _financialRepoMock;
    private readonly Mock<IRepository<Notification>> _notificationRepoMock;
    private readonly Mock<INotificationDispatchService> _dispatchServiceMock;
    private readonly ReservationService _service;

    public ReservationServiceTests()
    {
        _repositoryMock = new Mock<IRepository<Reservation>>();
        _spaceRepoMock = new Mock<IRepository<SharedSpace>>();
        _userRepoMock = new Mock<IRepository<User>>();
        _financialRepoMock = new Mock<IRepository<FinancialRecord>>();
        _notificationRepoMock = new Mock<IRepository<Notification>>();
        _dispatchServiceMock = new Mock<INotificationDispatchService>();

        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _financialRepoMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _notificationRepoMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _financialRepoMock.Setup(r => r.AddAsync(It.IsAny<FinancialRecord>())).Returns(Task.CompletedTask);
        _notificationRepoMock.Setup(r => r.AddAsync(It.IsAny<Notification>())).Returns(Task.CompletedTask);
        _dispatchServiceMock
            .Setup(d => d.DispatchAsync(It.IsAny<IEnumerable<Notification>>(), It.IsAny<bool>()))
            .Returns(Task.CompletedTask);

        _service = new ReservationService(
            _repositoryMock.Object,
            _spaceRepoMock.Object,
            _userRepoMock.Object,
            _financialRepoMock.Object,
            _notificationRepoMock.Object,
            _dispatchServiceMock.Object);
    }

    [Fact(Skip = "Legacy test - DTO fields updated. See ReservationServiceIsolationTests.")]
    public async Task CreateAsync_WhenNoConflict_CreatesReservation()
    {
        await Task.CompletedTask; // body removed — legacy ResidentId field no longer exists
    }

    [Fact(Skip = "Legacy test - DTO fields updated. See ReservationServiceIsolationTests.")]
    public async Task CreateAsync_WhenConflict_ReturnsError()
    {
        await Task.CompletedTask; // body removed — legacy DTOs (ResidentId, ReservationStatus.Confirmed) no longer exist
    }

    [Fact]
    public async Task CreateAsync_WhenValidData_CreatesReservation()
    {
        // Arrange
        var spaceId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var request = new CreateReservationRequest
        {
            SpaceId = spaceId,
            UserId = Guid.NewGuid(),
            StartTime = DateTime.UtcNow.AddHours(1),
            EndTime = DateTime.UtcNow.AddHours(2)
        };
        _spaceRepoMock.Setup(r => r.GetByIdAsync(spaceId))
            .ReturnsAsync(new SharedSpace { Id = spaceId, CondominiumId = condominiumId, Name = "Sala", ReservationFee = 0 });
        _userRepoMock.Setup(r => r.GetByIdAsync(request.UserId))
            .ReturnsAsync(new User { Id = request.UserId, CondominiumId = condominiumId, UnitId = Guid.NewGuid() });
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Reservation, bool>>>()))
            .ReturnsAsync(new List<Reservation>());
        _repositoryMock.Setup(r => r.AddAsync(It.IsAny<Reservation>())).Returns(Task.CompletedTask);

        // Act
        var (dto, error) = await _service.CreateAsync(condominiumId, request);

        // Assert
        error.Should().BeNull();
        dto.Should().NotBeNull();
        _repositoryMock.Verify(r => r.AddAsync(It.IsAny<Reservation>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_WhenSpaceNotFound_ReturnsError()
    {
        // Arrange
        var condominiumId = Guid.NewGuid();
        var request = new CreateReservationRequest
        {
            SpaceId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            StartTime = DateTime.UtcNow.AddHours(1),
            EndTime = DateTime.UtcNow.AddHours(2)
        };
        _spaceRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((SharedSpace?)null);

        // Act
        var (dto, error) = await _service.CreateAsync(condominiumId, request);

        // Assert
        error.Should().NotBeNull();
        dto.Should().BeNull();
    }

    [Fact]
    public async Task RequestCancellationAsync_WhenValidId_RequestsCancellation()
    {
        // Arrange
        var reservationId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        _repositoryMock.Setup(r => r.GetByIdAsync(reservationId))
            .ReturnsAsync(new Reservation { Id = reservationId, CondominiumId = condominiumId, Status = ReservationStatus.Approved });
        _repositoryMock.Setup(r => r.Update(It.IsAny<Reservation>()));
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        // Act
        var (dto, error) = await _service.RequestCancellationAsync(reservationId, condominiumId);

        // Assert
        error.Should().BeNull();
        dto.Should().NotBeNull();
        _repositoryMock.Verify(r => r.GetByIdAsync(reservationId), Times.Once);
        _repositoryMock.Verify(r => r.Update(It.IsAny<Reservation>()), Times.Once);
    }

    [Fact]
    public async Task RequestCancellationAsync_WhenInvalidId_ReturnsError()
    {
        // Arrange
        var reservationId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        _repositoryMock.Setup(r => r.GetByIdAsync(reservationId))
            .ReturnsAsync((Reservation?)null);

        // Act
        var (dto, error) = await _service.RequestCancellationAsync(reservationId, condominiumId);

        // Assert
        error.Should().NotBeNull();
        dto.Should().BeNull();
    }
}

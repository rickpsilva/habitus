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
    private readonly ReservationService _service;

    public ReservationServiceTests()
    {
        _repositoryMock = new Mock<IRepository<Reservation>>();
        _service = new ReservationService(_repositoryMock.Object);
    }

    [Fact]
    public async Task CreateAsync_WhenNoConflict_CreatesReservation()
    {
        var request = new CreateReservationRequest
        {
            SpaceId = Guid.NewGuid(),
            ResidentId = Guid.NewGuid(),
            StartTime = DateTime.UtcNow.AddHours(1),
            EndTime = DateTime.UtcNow.AddHours(3)
        };
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Reservation, bool>>>()))
            .ReturnsAsync(new List<Reservation>());
        _repositoryMock.Setup(r => r.AddAsync(It.IsAny<Reservation>())).Returns(Task.CompletedTask);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var (dto, error) = await _service.CreateAsync(request);

        dto.Should().NotBeNull();
        error.Should().BeNull();
        dto!.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task CreateAsync_WhenConflict_ReturnsError()
    {
        var spaceId = Guid.NewGuid();
        var start = DateTime.UtcNow.AddHours(1);
        var end = DateTime.UtcNow.AddHours(3);
        var existing = new Reservation
        {
            SpaceId = spaceId,
            StartTime = start,
            EndTime = end,
            Status = ReservationStatus.Confirmed
        };
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Reservation, bool>>>()))
            .ReturnsAsync(new List<Reservation> { existing });

        var (dto, error) = await _service.CreateAsync(new CreateReservationRequest
        {
            SpaceId = spaceId,
            ResidentId = Guid.NewGuid(),
            StartTime = start,
            EndTime = end
        });

        dto.Should().BeNull();
        error.Should().NotBeNull();
    }
}

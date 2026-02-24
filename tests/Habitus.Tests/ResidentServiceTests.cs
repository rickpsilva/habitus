using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Residents;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class ResidentServiceTests
{
    private readonly Mock<IRepository<Resident>> _repositoryMock;
    private readonly ResidentService _service;

    public ResidentServiceTests()
    {
        _repositoryMock = new Mock<IRepository<Resident>>();
        _service = new ResidentService(_repositoryMock.Object);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAllResidents()
    {
        var residents = new List<Resident>
        {
            new() { Id = Guid.NewGuid(), Name = "Alice", Email = "alice@test.com", Role = ResidentRole.Resident }
        };
        _repositoryMock.Setup(r => r.GetAllAsync()).ReturnsAsync(residents);

        var result = await _service.GetAllAsync();

        result.Should().HaveCount(1);
        result.First().Name.Should().Be("Alice");
    }

    [Fact]
    public async Task GetByIdAsync_WhenExists_ReturnsResident()
    {
        var id = Guid.NewGuid();
        var resident = new Resident { Id = id, Name = "Bob", Email = "bob@test.com", Role = ResidentRole.Admin };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(resident);

        var result = await _service.GetByIdAsync(id);

        result.Should().NotBeNull();
        result!.Name.Should().Be("Bob");
    }

    [Fact]
    public async Task GetByIdAsync_WhenNotExists_ReturnsNull()
    {
        _repositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((Resident?)null);

        var result = await _service.GetByIdAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_CreatesAndReturnsResident()
    {
        var request = new CreateResidentRequest
        {
            Name = "Charlie",
            Email = "charlie@test.com",
            Password = "password123",
            Phone = "123456789",
            UnitId = Guid.NewGuid(),
            Role = "Resident"
        };
        _repositoryMock.Setup(r => r.AddAsync(It.IsAny<Resident>())).Returns(Task.CompletedTask);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await _service.CreateAsync(request);

        result.Should().NotBeNull();
        result.Name.Should().Be("Charlie");
        result.Email.Should().Be("charlie@test.com");
    }

    [Fact]
    public async Task DeleteAsync_WhenExists_ReturnsTrue()
    {
        var id = Guid.NewGuid();
        var resident = new Resident { Id = id };
        _repositoryMock.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(resident);
        _repositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await _service.DeleteAsync(id);

        result.Should().BeTrue();
    }
}

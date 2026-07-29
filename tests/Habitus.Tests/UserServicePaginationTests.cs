using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class UserServicePaginationTests
{
    private readonly Mock<IRepository<User>> _userRepositoryMock;
    private readonly UserService _service;

    public UserServicePaginationTests()
    {
        _userRepositoryMock = new Mock<IRepository<User>>();
        var userCondominiumMock = new Mock<IRepository<UserCondominium>>();
        var condominiumMock = new Mock<IRepository<Condominium>>();
        var unitMock = new Mock<IRepository<Unit>>();
        var encryptionMock = new Mock<IEncryptionService>();

        _service = new UserService(
            _userRepositoryMock.Object,
            userCondominiumMock.Object,
            condominiumMock.Object,
            unitMock.Object,
            encryptionMock.Object);
    }

    private static User UserOf(UserRole role, string name)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Email = $"{name}@example.com",
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

    private void SetupRepositoryWithPredicate(IEnumerable<User> users)
    {
        _userRepositoryMock
            .Setup(r => r.FindWithIncludesAsync(
                It.IsAny<Expression<Func<User, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync((Expression<Func<User, bool>> predicate, string[] _) =>
                users.Where(predicate.Compile()).ToList());
    }

    [Fact]
    public async Task GetPagedUsersAsync_ExcludesAdminsAndResidents()
    {
        var users = new List<User>
        {
            UserOf(UserRole.Manager, "Manager A"),
            UserOf(UserRole.Manager, "Manager B"),
            UserOf(UserRole.Admin, "Admin A"),
            UserOf(UserRole.Resident, "Resident A"),
        };
        SetupRepositoryWithPredicate(users);

        var result = await _service.GetPagedUsersAsync(page: 1, pageSize: 10);

        result.Items.Should().OnlyContain(u => u.Role == (int)UserRole.Manager);
        result.TotalItems.Should().Be(2);
    }

    [Fact]
    public async Task GetPagedUsersAsync_TotalsCountOnlyManagers()
    {
        var users = new List<User>
        {
            UserOf(UserRole.Manager, "Manager A"),
            UserOf(UserRole.Manager, "Manager B"),
            UserOf(UserRole.Manager, "Manager C"),
            UserOf(UserRole.Admin, "Admin A"),
            UserOf(UserRole.Resident, "Resident A"),
            UserOf(UserRole.Resident, "Resident B"),
        };
        SetupRepositoryWithPredicate(users);

        var result = await _service.GetPagedUsersAsync(page: 1, pageSize: 2);

        result.TotalItems.Should().Be(3);
        result.TotalPages.Should().Be(2);
        result.Items.Should().HaveCount(2);
        result.Items.Should().OnlyContain(u => u.Role == (int)UserRole.Manager);
    }

    [Fact]
    public async Task GetUsersByCondominiumPagedAsync_ExcludesManagersAndOtherCondominiums()
    {
        var condominiumId = Guid.NewGuid();
        var otherCondominiumId = Guid.NewGuid();
        var users = new List<User>
        {
            new() { Id = Guid.NewGuid(), Name = "Admin A", Email = "admin-a@example.com", Role = UserRole.Admin, CondominiumId = condominiumId, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident A", Email = "resident-a@example.com", Role = UserRole.Resident, CondominiumId = condominiumId, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Manager A", Email = "manager-a@example.com", Role = UserRole.Manager, CondominiumId = condominiumId, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident B", Email = "resident-b@example.com", Role = UserRole.Resident, CondominiumId = otherCondominiumId, IsActive = true, CreatedAt = DateTime.UtcNow },
        };
        SetupRepositoryWithPredicate(users);

        var result = await _service.GetUsersByCondominiumPagedAsync(condominiumId, page: 1, pageSize: 10);

        result.TotalItems.Should().Be(2);
        result.Items.Should().OnlyContain(u => u.CondominiumId == condominiumId && u.Role != (int)UserRole.Manager);
    }
}

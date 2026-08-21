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
    private readonly Mock<IRepository<UserCondominium>> _userCondominiumRepositoryMock;
    private readonly UserService _service;

    public UserServicePaginationTests()
    {
        _userRepositoryMock = new Mock<IRepository<User>>();
        _userCondominiumRepositoryMock = new Mock<IRepository<UserCondominium>>();
        var condominiumMock = new Mock<IRepository<Condominium>>();
        var unitMock = new Mock<IRepository<Unit>>();
        var encryptionMock = new Mock<IEncryptionService>();

        _service = new UserService(
            _userRepositoryMock.Object,
            _userCondominiumRepositoryMock.Object,
            condominiumMock.Object,
            unitMock.Object,
            encryptionMock.Object);
    }

    private static User UserOf(UserRole role, string name, Guid? condominiumId = null)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Role = role,
            IsActive = true,
            CondominiumId = condominiumId,
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
            new() { Id = Guid.NewGuid(), Name = "Admin A", Role = UserRole.Admin, CondominiumId = condominiumId, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident A", Role = UserRole.Resident, CondominiumId = condominiumId, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Manager A", Role = UserRole.Manager, CondominiumId = condominiumId, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident B", Role = UserRole.Resident, CondominiumId = otherCondominiumId, IsActive = true, CreatedAt = DateTime.UtcNow },
        };
        SetupRepositoryWithPredicate(users);

        var result = await _service.GetUsersByCondominiumPagedAsync(condominiumId, page: 1, pageSize: 10);

        result.TotalItems.Should().Be(2);
        result.Items.Should().OnlyContain(u => u.CondominiumId == condominiumId && u.Role != (int)UserRole.Manager);
    }

    [Fact]
    public async Task GetImpersonatableUsersPagedAsync_WithNoUserCondominiumEntries_ReturnsAllAdminsAndResidents()
    {
        // Arrange: Manager with NO UserCondominium entries (platform-level manager)
        var managerId = Guid.NewGuid();
        var condominiumId1 = Guid.NewGuid();
        var condominiumId2 = Guid.NewGuid();
        
        var users = new List<User>
        {
            new() { Id = Guid.NewGuid(), Name = "Admin A", Role = UserRole.Admin, CondominiumId = condominiumId1, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident A", Role = UserRole.Resident, CondominiumId = condominiumId1, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Admin B", Role = UserRole.Admin, CondominiumId = condominiumId2, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident B", Role = UserRole.Resident, CondominiumId = condominiumId2, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Manager C", Role = UserRole.Manager, CondominiumId = null, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Inactive Admin", Role = UserRole.Admin, CondominiumId = condominiumId1, IsActive = false, CreatedAt = DateTime.UtcNow },
        };
        SetupRepositoryWithPredicate(users);

        // Manager has NO UserCondominium entries
        _userCondominiumRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>()))
            .ReturnsAsync(new List<UserCondominium>());

        // Act
        var result = await _service.GetImpersonatableUsersPagedAsync(managerId, page: 1, pageSize: 10);

        // Assert: Should return all active Admins and Residents from ALL condominiums
        result.Items.Should().HaveCount(4);
        result.TotalItems.Should().Be(4);
        result.Items.Should().OnlyContain(u => u.Role == (int)UserRole.Admin || u.Role == (int)UserRole.Resident);
        result.Items.Should().OnlyContain(u => u.IsActive == true);
    }

    [Fact]
    public async Task GetImpersonatableUsersPagedAsync_WithSpecificCondominiumFilter_ReturnsOnlyThatCondominium()
    {
        // Arrange: Manager with NO UserCondominium entries but specific condominium requested
        var managerId = Guid.NewGuid();
        var condominiumId1 = Guid.NewGuid();
        var condominiumId2 = Guid.NewGuid();
        
        var users = new List<User>
        {
            new() { Id = Guid.NewGuid(), Name = "Admin A", Role = UserRole.Admin, CondominiumId = condominiumId1, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident A", Role = UserRole.Resident, CondominiumId = condominiumId1, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Admin B", Role = UserRole.Admin, CondominiumId = condominiumId2, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident B", Role = UserRole.Resident, CondominiumId = condominiumId2, IsActive = true, CreatedAt = DateTime.UtcNow },
        };
        SetupRepositoryWithPredicate(users);

        // Manager has NO UserCondominium entries
        _userCondominiumRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>()))
            .ReturnsAsync(new List<UserCondominium>());

        // Act: Request specific condominium
        var result = await _service.GetImpersonatableUsersPagedAsync(managerId, page: 1, pageSize: 10, condominiumId: condominiumId1);

        // Assert: Should return only users from the requested condominium
        result.Items.Should().HaveCount(2);
        result.TotalItems.Should().Be(2);
        result.Items.Should().OnlyContain(u => u.CondominiumId == condominiumId1);
    }

    [Fact]
    public async Task GetImpersonatableUsersPagedAsync_WithUserCondominiumEntries_ReturnsOnlyAccessibleCondominiums()
    {
        // Arrange: Manager WITH UserCondominium entries for specific condominiums
        var managerId = Guid.NewGuid();
        var condominiumId1 = Guid.NewGuid();
        var condominiumId2 = Guid.NewGuid();
        var condominiumId3 = Guid.NewGuid();
        
        var users = new List<User>
        {
            new() { Id = Guid.NewGuid(), Name = "Admin A", Role = UserRole.Admin, CondominiumId = condominiumId1, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident A", Role = UserRole.Resident, CondominiumId = condominiumId1, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Admin B", Role = UserRole.Admin, CondominiumId = condominiumId2, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident B", Role = UserRole.Resident, CondominiumId = condominiumId2, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Admin C", Role = UserRole.Admin, CondominiumId = condominiumId3, IsActive = true, CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Name = "Resident C", Role = UserRole.Resident, CondominiumId = condominiumId3, IsActive = true, CreatedAt = DateTime.UtcNow },
        };
        SetupRepositoryWithPredicate(users);

        // Manager has UserCondominium entries for condominiumId1 and condominiumId2 only
        _userCondominiumRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>()))
            .ReturnsAsync(new List<UserCondominium>
            {
                new() { UserId = managerId, CondominiumId = condominiumId1, CanManage = true },
                new() { UserId = managerId, CondominiumId = condominiumId2, CanManage = true },
            });

        // Act
        var result = await _service.GetImpersonatableUsersPagedAsync(managerId, page: 1, pageSize: 10);

        // Assert: Should return only users from accessible condominiums (condominiumId1 and condominiumId2)
        result.Items.Should().HaveCount(4);
        result.TotalItems.Should().Be(4);
        result.Items.Should().OnlyContain(u => u.CondominiumId == condominiumId1 || u.CondominiumId == condominiumId2);
    }
}

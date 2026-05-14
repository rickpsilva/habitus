using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class GdprErasureTests
{
    private readonly Mock<IRepository<User>> _userRepositoryMock = new();
    private readonly Mock<IRepository<UserCondominium>> _userCondominiumRepositoryMock = new();
    private readonly Mock<IRepository<Condominium>> _condominiumRepositoryMock = new();
    private readonly Mock<IRepository<Unit>> _unitRepositoryMock = new();
    private readonly Mock<IRepository<UserGdprConsent>> _userGdprConsentRepositoryMock = new();
    private readonly Mock<IRepository<Notification>> _notificationRepositoryMock = new();
    private readonly Mock<INotificationDispatchService> _notificationDispatchServiceMock = new();

    private readonly UserService _service;

    public GdprErasureTests()
    {
        _userRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userCondominiumRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _condominiumRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _unitRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userGdprConsentRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _notificationRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        _service = new UserService(
            _userRepositoryMock.Object,
            _userCondominiumRepositoryMock.Object,
            _condominiumRepositoryMock.Object,
            _unitRepositoryMock.Object,
            _userGdprConsentRepositoryMock.Object,
            _notificationRepositoryMock.Object,
            _notificationDispatchServiceMock.Object);
    }

    [Fact]
    public async Task RequestGdprErasureAsync_WhenCondominiumUser_ShouldCreateAdminNotificationOnly()
    {
        var userId = Guid.NewGuid();
        var condoId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            Name = "User",
            Email = "user@test.com",
            Phone = "911",
            CondominiumId = condoId,
            Role = UserRole.Resident
        };

        var createdNotifications = new List<Notification>();
        _userRepositoryMock.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(user);
        _notificationRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Notification>()))
            .Callback<Notification>(n => createdNotifications.Add(n))
            .Returns(Task.CompletedTask);

        await _service.RequestGdprErasureAsync(userId, "127.0.0.1");

        user.GdprErasureRequestedAt.Should().NotBeNull();
        createdNotifications.Should().ContainSingle();
        createdNotifications[0].TargetRole.Should().Be("Admin");
        createdNotifications[0].TargetUserId.Should().BeNull();
        createdNotifications[0].CondominiumId.Should().Be(condoId);
        _notificationDispatchServiceMock.Verify(d => d.DispatchAsync(
            It.Is<IEnumerable<Notification>>(batch => batch.Count() == 1),
            true), Times.Once);
    }

    [Fact]
    public async Task RequestGdprErasureAsync_WhenAlreadyRequested_ShouldThrow()
    {
        var userId = Guid.NewGuid();
        _userRepositoryMock.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Name = "User",
            Email = "user@test.com",
            Phone = "911",
            GdprErasureRequestedAt = DateTime.UtcNow.AddDays(-1),
        });

        var act = () => _service.RequestGdprErasureAsync(userId, "127.0.0.1");

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Pedido de eliminação já foi efetuado*");
    }

    [Fact]
    public async Task ApproveGdprErasureAsync_WhenPending_ShouldAnonymizeUser()
    {
        var userId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            Name = "User",
            Email = "user@test.com",
            Phone = "911",
            GdprErasureRequestedAt = DateTime.UtcNow.AddHours(-1),
        };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(user);

        await _service.ApproveGdprErasureAsync(userId, managerId);

        user.IsDeleted.Should().BeTrue();
        user.Name.Should().Be("DELETED USER");
        user.Email.Should().Contain("@deleted.local");
        user.Phone.Should().BeNull();
        user.DeletionReason.Should().Be("GDPR_ERASURE");
        user.DeletedAt.Should().NotBeNull();
    }
}

using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class NotificationServiceIsolationTests
{
    private readonly Mock<IRepository<Notification>> _repositoryMock = new();
    private readonly NotificationService _service;

    private readonly Guid _condominiumA = Guid.NewGuid();
    private readonly Guid _condominiumB = Guid.NewGuid();
    private readonly Guid _residentUserId = Guid.NewGuid();

    public NotificationServiceIsolationTests()
    {
        _service = new NotificationService(_repositoryMock.Object);
    }

    private void SetupFind(List<Notification> source) =>
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Notification, bool>>>()))
            .ReturnsAsync((Expression<Func<Notification, bool>> predicate) =>
                source.Where(predicate.Compile()).ToList());

    [Fact]
    public async Task MarkAllAsReadAsync_ResidentInCondoA_OnlyMarksAccessibleUnreadNotifications()
    {
        var condoAResident = new Notification { Id = Guid.NewGuid(), CondominiumId = _condominiumA, TargetRole = "Resident", IsRead = false };
        var condoAUntargeted = new Notification { Id = Guid.NewGuid(), CondominiumId = _condominiumA, TargetRole = "", IsRead = false };
        var condoAAdminOnly = new Notification { Id = Guid.NewGuid(), CondominiumId = _condominiumA, TargetRole = "Admin", IsRead = false };
        var condoBResident = new Notification { Id = Guid.NewGuid(), CondominiumId = _condominiumB, TargetRole = "Resident", IsRead = false };
        var condoAAlreadyRead = new Notification { Id = Guid.NewGuid(), CondominiumId = _condominiumA, TargetRole = "Resident", IsRead = true };

        SetupFind(new List<Notification>
        {
            condoAResident, condoAUntargeted, condoAAdminOnly, condoBResident, condoAAlreadyRead
        });

        await _service.MarkAllAsReadAsync(_condominiumA, "Resident", _residentUserId);

        condoAResident.IsRead.Should().BeTrue();
        condoAUntargeted.IsRead.Should().BeTrue();
        condoAAdminOnly.IsRead.Should().BeFalse();
        condoBResident.IsRead.Should().BeFalse();

        _repositoryMock.Verify(r => r.Update(condoAResident), Times.Once);
        _repositoryMock.Verify(r => r.Update(condoAUntargeted), Times.Once);
        _repositoryMock.Verify(r => r.Update(condoAAdminOnly), Times.Never);
        _repositoryMock.Verify(r => r.Update(condoBResident), Times.Never);
        _repositoryMock.Verify(r => r.Update(condoAAlreadyRead), Times.Never);
        _repositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }
}

using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class NotificationServicePaginationTests
{
    private readonly Mock<IRepository<Notification>> _repositoryMock = new();
    private readonly NotificationService _service;

    public NotificationServicePaginationTests()
    {
        _service = new NotificationService(_repositoryMock.Object);
    }

    private static Notification Notif(Guid condominiumId, Guid? targetUserId, string targetRole)
        => new()
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            TargetUserId = targetUserId,
            TargetRole = targetRole,
            SentAt = DateTime.UtcNow
        };

    private Expression<Func<Notification, bool>> CaptureFilter(Guid condominiumId, string userRole, Guid userId)
    {
        Expression<Func<Notification, bool>>? captured = null;
        _repositoryMock
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<Notification, bool>>>(),
                It.IsAny<Expression<Func<Notification, object>>>(),
                It.IsAny<bool>()))
            .Callback<int, int, Expression<Func<Notification, bool>>, Expression<Func<Notification, object>>, bool>(
                (_, _, filter, _, _) => captured = filter)
            .ReturnsAsync(new PaginatedResponse<Notification>());

        _service.GetPagedAsync(1, 10, condominiumId, userRole, userId).GetAwaiter().GetResult();
        return captured!;
    }

    [Fact]
    public async Task GetPagedAsync_Manager_SeesManagerTargetedAndDirectOnly()
    {
        var condo = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var predicate = CaptureFilter(condo, "Manager", userId).Compile();

        predicate(Notif(condo, targetUserId: null, targetRole: "Manager")).Should().BeTrue();   // role-targeted
        predicate(Notif(condo, targetUserId: userId, targetRole: "")).Should().BeTrue();         // direct to user
        predicate(Notif(condo, targetUserId: null, targetRole: "")).Should().BeFalse();          // generic condominium
        predicate(Notif(condo, targetUserId: null, targetRole: "Resident")).Should().BeFalse();  // resident-targeted

        await Task.CompletedTask;
    }

    [Fact]
    public async Task GetPagedAsync_Resident_SeesRoleGenericAndDirectWithinCondominium()
    {
        var condo = Guid.NewGuid();
        var other = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var predicate = CaptureFilter(condo, "Resident", userId).Compile();

        predicate(Notif(condo, targetUserId: null, targetRole: "Resident")).Should().BeTrue();   // role match
        predicate(Notif(condo, targetUserId: null, targetRole: "")).Should().BeTrue();           // generic (shared)
        predicate(Notif(condo, targetUserId: userId, targetRole: "")).Should().BeTrue();          // direct to user
        predicate(Notif(condo, targetUserId: null, targetRole: "Manager")).Should().BeFalse();   // manager-targeted
        predicate(Notif(other, targetUserId: null, targetRole: "Resident")).Should().BeFalse();  // other condominium

        await Task.CompletedTask;
    }

    [Fact]
    public async Task GetPagedAsync_ForwardsRepositoryMetadata_AndNormalizesArguments()
    {
        var condo = Guid.NewGuid();
        var capturedPage = 0;
        var capturedPageSize = 0;
        _repositoryMock
            .Setup(r => r.GetPagedAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<Notification, bool>>>(),
                It.IsAny<Expression<Func<Notification, object>>>(),
                It.IsAny<bool>()))
            .Callback<int, int, Expression<Func<Notification, bool>>, Expression<Func<Notification, object>>, bool>(
                (page, pageSize, _, _, _) => { capturedPage = page; capturedPageSize = pageSize; })
            .ReturnsAsync(new PaginatedResponse<Notification>
            {
                Items = new List<Notification> { Notif(condo, null, "Resident") },
                Page = 1,
                PageSize = 10,
                TotalItems = 5,
                TotalPages = 1
            });

        var result = await _service.GetPagedAsync(0, 999, condo, "Resident", Guid.NewGuid());

        capturedPage.Should().Be(1);
        capturedPageSize.Should().Be(10);
        result.TotalItems.Should().Be(5);
        result.Items.Should().ContainSingle();
    }
}

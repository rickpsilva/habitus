using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class AssociationRequestServiceTests
{
    private readonly Mock<IRepository<UserCondominiumAssociationRequest>> _associationRequests = new();
    private readonly Mock<IRepository<UserCondominium>> _userCondominiums = new();
    private readonly Mock<IRepository<User>> _users = new();
    private readonly Mock<IRepository<Condominium>> _condominiums = new();
    private readonly Mock<IRepository<Notification>> _notifications = new();
    private readonly Mock<INotificationDispatchService> _dispatch = new();

    private readonly List<UserCondominiumAssociationRequest> _requestRows = new();
    private readonly List<UserCondominium> _associationRows = new();

    private readonly AssociationRequestService _service;

    public AssociationRequestServiceTests()
    {
        _associationRequests.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userCondominiums.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _users.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _notifications.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        _associationRequests
            .Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<UserCondominiumAssociationRequest, bool>>>() ))
            .ReturnsAsync((Expression<Func<UserCondominiumAssociationRequest, bool>> predicate) =>
                _requestRows.Any(predicate.Compile()));

        _associationRequests
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCondominiumAssociationRequest, bool>>>() ))
            .ReturnsAsync((Expression<Func<UserCondominiumAssociationRequest, bool>> predicate) =>
                _requestRows.Where(predicate.Compile()).ToList());

        _associationRequests
            .Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => _requestRows.FirstOrDefault(r => r.Id == id));

        _associationRequests
            .Setup(r => r.AddAsync(It.IsAny<UserCondominiumAssociationRequest>()))
            .Callback<UserCondominiumAssociationRequest>(row => _requestRows.Add(row))
            .Returns(Task.CompletedTask);

        _associationRequests
            .Setup(r => r.Update(It.IsAny<UserCondominiumAssociationRequest>()))
            .Callback<UserCondominiumAssociationRequest>(row =>
            {
                var index = _requestRows.FindIndex(r => r.Id == row.Id);
                if (index >= 0)
                {
                    _requestRows[index] = row;
                }
            });

        _userCondominiums
            .Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>() ))
            .ReturnsAsync((Expression<Func<UserCondominium, bool>> predicate) =>
                _associationRows.Any(predicate.Compile()));

        _userCondominiums
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>() ))
            .ReturnsAsync((Expression<Func<UserCondominium, bool>> predicate) =>
                _associationRows.FirstOrDefault(predicate.Compile()));

        _userCondominiums
            .Setup(r => r.AddAsync(It.IsAny<UserCondominium>()))
            .Callback<UserCondominium>(row => _associationRows.Add(row))
            .Returns(Task.CompletedTask);

        _userCondominiums
            .Setup(r => r.Update(It.IsAny<UserCondominium>()))
            .Callback<UserCondominium>(row =>
            {
                var index = _associationRows.FindIndex(r => r.UserId == row.UserId && r.CondominiumId == row.CondominiumId);
                if (index >= 0)
                {
                    _associationRows[index] = row;
                }
            });

        _service = new AssociationRequestService(
            _associationRequests.Object,
            _userCondominiums.Object,
            _users.Object,
            _condominiums.Object,
            _notifications.Object,
            _dispatch.Object);
    }

    [Fact]
    public async Task CreateRequestAsync_WhenPendingExists_ShouldReturnAlreadyPendingConflict()
    {
        var userId = Guid.NewGuid();
        var condoId = Guid.NewGuid();

        _users.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(new User { Id = userId, IsActive = true });
        _condominiums.Setup(r => r.GetByIdAsync(condoId)).ReturnsAsync(new Condominium { Id = condoId, Name = "A" });

        _requestRows.Add(new UserCondominiumAssociationRequest
        {
            Id = Guid.NewGuid(),
            RequesterUserId = userId,
            TargetCondominiumId = condoId,
            RequestedRole = AssociationRequestedRole.Admin,
            Status = AssociationRequestStatus.Pending,
        });

        var action = () => _service.CreateRequestAsync(
            userId,
            UserRole.Admin.ToString(),
            condoId,
            AssociationRequestedRole.Admin,
            AssociationRequestSource.Manual,
            null);

        var ex = await action.Should().ThrowAsync<AssociationRequestConflictException>();
        ex.Which.Code.Should().Be("already_pending");
    }

    [Fact]
    public async Task CreateRequestAsync_WhenUserAlreadyAssociated_ShouldReturnAlreadyAssociatedConflict()
    {
        var userId = Guid.NewGuid();
        var condoId = Guid.NewGuid();

        _users.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(new User { Id = userId, IsActive = true });
        _condominiums.Setup(r => r.GetByIdAsync(condoId)).ReturnsAsync(new Condominium { Id = condoId, Name = "A" });

        _associationRows.Add(new UserCondominium
        {
            UserId = userId,
            CondominiumId = condoId,
            CanManage = false,
            GrantedAt = DateTime.UtcNow,
        });

        var action = () => _service.CreateRequestAsync(
            userId,
            UserRole.Resident.ToString(),
            condoId,
            AssociationRequestedRole.Resident,
            AssociationRequestSource.Manual,
            null);

        var ex = await action.Should().ThrowAsync<AssociationRequestConflictException>();
        ex.Which.Code.Should().Be("already_associated");
    }

    [Fact]
    public async Task ApproveAsync_WhenRequestNotPending_ShouldReturnRequestNotPendingConflict()
    {
        var reviewerId = Guid.NewGuid();
        var condoId = Guid.NewGuid();
        var requestId = Guid.NewGuid();

        _users.Setup(r => r.GetByIdAsync(reviewerId)).ReturnsAsync(new User
        {
            Id = reviewerId,
            Role = UserRole.Admin,
            IsActive = true,
        });

        _associationRows.Add(new UserCondominium
        {
            UserId = reviewerId,
            CondominiumId = condoId,
            CanManage = true,
            GrantedAt = DateTime.UtcNow,
        });

        _requestRows.Add(new UserCondominiumAssociationRequest
        {
            Id = requestId,
            RequesterUserId = Guid.NewGuid(),
            TargetCondominiumId = condoId,
            RequestedRole = AssociationRequestedRole.Admin,
            Status = AssociationRequestStatus.Approved,
            RequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });

        var action = () => _service.ApproveAsync(requestId, reviewerId, condoId, null);

        var ex = await action.Should().ThrowAsync<AssociationRequestConflictException>();
        ex.Which.Code.Should().Be("request_not_pending");
    }

    [Fact]
    public async Task ApproveAsync_ForAdminRequest_ShouldCreateManageAssociationAndApprove()
    {
        var reviewerId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var condoId = Guid.NewGuid();
        var requestId = Guid.NewGuid();

        _users.Setup(r => r.GetByIdAsync(reviewerId)).ReturnsAsync(new User
        {
            Id = reviewerId,
            Role = UserRole.Admin,
            IsActive = true,
        });

        _associationRows.Add(new UserCondominium
        {
            UserId = reviewerId,
            CondominiumId = condoId,
            CanManage = true,
            GrantedAt = DateTime.UtcNow,
        });

        _requestRows.Add(new UserCondominiumAssociationRequest
        {
            Id = requestId,
            RequesterUserId = requesterId,
            TargetCondominiumId = condoId,
            RequestedRole = AssociationRequestedRole.Admin,
            Status = AssociationRequestStatus.Pending,
            RequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });

        var result = await _service.ApproveAsync(requestId, reviewerId, condoId, "ok");

        result.Status.Should().Be(AssociationRequestStatus.Approved);
        _associationRows.Should().ContainSingle(a => a.UserId == requesterId && a.CondominiumId == condoId && a.CanManage);
        _dispatch.Verify(d => d.DispatchAsync(It.IsAny<IEnumerable<Notification>>(), true), Times.Once);
    }
}

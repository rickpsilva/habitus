using Habitus.Application.DTOs.Memberships;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public sealed class AssociationRequestConflictException : Exception
{
    public AssociationRequestConflictException(string code, string message) : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}

public class AssociationRequestService
{
    private readonly IRepository<UserCondominiumAssociationRequest> _associationRequestRepository;
    private readonly IRepository<UserCondominium> _userCondominiumRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<Notification> _notificationRepository;
    private readonly INotificationDispatchService _notificationDispatchService;

    public AssociationRequestService(
        IRepository<UserCondominiumAssociationRequest> associationRequestRepository,
        IRepository<UserCondominium> userCondominiumRepository,
        IRepository<User> userRepository,
        IRepository<Condominium> condominiumRepository,
        IRepository<Notification> notificationRepository,
        INotificationDispatchService notificationDispatchService)
    {
        _associationRequestRepository = associationRequestRepository;
        _userCondominiumRepository = userCondominiumRepository;
        _userRepository = userRepository;
        _condominiumRepository = condominiumRepository;
        _notificationRepository = notificationRepository;
        _notificationDispatchService = notificationDispatchService;
    }

    public async Task<AssociationRequestResponseDto> CreateRequestAsync(
        Guid currentUserId,
        string currentRole,
        Guid targetCondominiumId,
        AssociationRequestedRole requestedRole,
        AssociationRequestSource source,
        string? correlationId = null)
    {
        if (!IsValidRequestedRole(requestedRole))
        {
            throw new InvalidOperationException("RequestedRole must be Admin or Resident.");
        }

        var currentUser = await _userRepository.GetByIdAsync(currentUserId)
            ?? throw new InvalidOperationException("Requester user not found.");

        if (!currentUser.IsActive)
        {
            throw new InvalidOperationException("Inactive users cannot create association requests.");
        }

        var role = currentRole?.Trim() ?? string.Empty;
        if (role.Equals(UserRole.Manager.ToString(), StringComparison.OrdinalIgnoreCase) &&
            requestedRole == AssociationRequestedRole.Resident)
        {
            throw new InvalidOperationException("Manager cannot request Resident association through this workflow.");
        }

        var condominium = await _condominiumRepository.GetByIdAsync(targetCondominiumId);
        if (condominium == null)
        {
            throw new InvalidOperationException("Target condominium was not found.");
        }

        var isAlreadyAssociated = await _userCondominiumRepository.ExistsAsync(uc =>
            uc.UserId == currentUserId && uc.CondominiumId == targetCondominiumId);
        if (isAlreadyAssociated)
        {
            throw new AssociationRequestConflictException("already_associated", "User is already associated to this condominium.");
        }

        var hasPendingDuplicate = await _associationRequestRepository.ExistsAsync(r =>
            r.RequesterUserId == currentUserId &&
            r.TargetCondominiumId == targetCondominiumId &&
            r.RequestedRole == requestedRole &&
            r.Status == AssociationRequestStatus.Pending);

        if (hasPendingDuplicate)
        {
            throw new AssociationRequestConflictException("already_pending", "There is already a pending request for this user and condominium.");
        }

        var request = new UserCondominiumAssociationRequest
        {
            Id = Guid.NewGuid(),
            RequesterUserId = currentUserId,
            TargetCondominiumId = targetCondominiumId,
            RequestedRole = requestedRole,
            Status = AssociationRequestStatus.Pending,
            Source = source,
            RequestedAt = DateTime.UtcNow,
            CorrelationId = NormalizeCorrelationId(correlationId),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _associationRequestRepository.AddAsync(request);
        await _associationRequestRepository.SaveChangesAsync();

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = "Novo pedido de associação",
            Message = $"Um utilizador pediu associação ao condomínio {condominium.Name}.",
            Type = NotificationType.Info,
            TargetRole = UserRole.Admin.ToString(),
            CondominiumId = targetCondominiumId,
            SentAt = DateTime.UtcNow,
            IsRead = false,
        };

        await _notificationRepository.AddAsync(notification);
        await _notificationRepository.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        return MapToDto(request);
    }

    public async Task<IReadOnlyCollection<AssociationRequestResponseDto>> GetMyRequestsAsync(
        Guid currentUserId,
        AssociationRequestStatus? status = null)
    {
        var requests = await _associationRequestRepository.FindAsync(r =>
            r.RequesterUserId == currentUserId &&
            (!status.HasValue || r.Status == status.Value));

        return requests
            .OrderByDescending(r => r.RequestedAt)
            .Select(MapToDto)
            .ToList();
    }

    public async Task<IReadOnlyCollection<AssociationRequestResponseDto>> GetPendingForCondominiumAsync(
        Guid adminUserId,
        Guid condominiumId)
    {
        var canReview = await IsReviewerAuthorizedAsync(adminUserId, condominiumId);
        if (!canReview)
        {
            throw new UnauthorizedAccessException("Only the target condominium Admin can list pending requests.");
        }

        var requests = await _associationRequestRepository.FindAsync(r =>
            r.TargetCondominiumId == condominiumId &&
            r.Status == AssociationRequestStatus.Pending);

        return requests
            .OrderBy(r => r.RequestedAt)
            .Select(MapToDto)
            .ToList();
    }

    public Task<AssociationRequestResponseDto> ApproveAsync(
        Guid requestId,
        Guid reviewerUserId,
        Guid reviewerCondominiumId,
        string? reason = null)
        => ReviewAsync(requestId, reviewerUserId, reviewerCondominiumId, AssociationRequestStatus.Approved, reason);

    public Task<AssociationRequestResponseDto> RejectAsync(
        Guid requestId,
        Guid reviewerUserId,
        Guid reviewerCondominiumId,
        string? reason = null)
        => ReviewAsync(requestId, reviewerUserId, reviewerCondominiumId, AssociationRequestStatus.Rejected, reason);

    private async Task<AssociationRequestResponseDto> ReviewAsync(
        Guid requestId,
        Guid reviewerUserId,
        Guid reviewerCondominiumId,
        AssociationRequestStatus finalStatus,
        string? reason)
    {
        if (finalStatus != AssociationRequestStatus.Approved && finalStatus != AssociationRequestStatus.Rejected)
        {
            throw new InvalidOperationException("Final status must be Approved or Rejected.");
        }

        var request = await _associationRequestRepository.GetByIdAsync(requestId)
            ?? throw new KeyNotFoundException("Association request not found.");

        if (request.TargetCondominiumId != reviewerCondominiumId)
        {
            throw new UnauthorizedAccessException("Reviewer scope does not match target condominium.");
        }

        var canReview = await IsReviewerAuthorizedAsync(reviewerUserId, reviewerCondominiumId);
        if (!canReview)
        {
            throw new UnauthorizedAccessException("Only the target condominium Admin can review this request.");
        }

        if (request.Status != AssociationRequestStatus.Pending)
        {
            throw new AssociationRequestConflictException("request_not_pending", "The request is no longer pending.");
        }

        if (finalStatus == AssociationRequestStatus.Approved)
        {
            var existingAssociation = await _userCondominiumRepository.FirstOrDefaultAsync(uc =>
                uc.UserId == request.RequesterUserId && uc.CondominiumId == request.TargetCondominiumId);

            if (existingAssociation == null)
            {
                await _userCondominiumRepository.AddAsync(new UserCondominium
                {
                    UserId = request.RequesterUserId,
                    CondominiumId = request.TargetCondominiumId,
                    GrantedAt = DateTime.UtcNow,
                    CanManage = request.RequestedRole == AssociationRequestedRole.Admin,
                });
            }
            else if (request.RequestedRole == AssociationRequestedRole.Admin && !existingAssociation.CanManage)
            {
                existingAssociation.CanManage = true;
                _userCondominiumRepository.Update(existingAssociation);
            }

            await _userCondominiumRepository.SaveChangesAsync();
        }

        request.Status = finalStatus;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewedByUserId = reviewerUserId;
        request.ReviewReason = NormalizeReason(reason);
        request.UpdatedAt = DateTime.UtcNow;

        _associationRequestRepository.Update(request);
        await _associationRequestRepository.SaveChangesAsync();

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = finalStatus == AssociationRequestStatus.Approved
                ? "Pedido de associação aprovado"
                : "Pedido de associação rejeitado",
            Message = finalStatus == AssociationRequestStatus.Approved
                ? "O seu pedido de associação ao condomínio foi aprovado."
                : "O seu pedido de associação ao condomínio foi rejeitado.",
            Type = finalStatus == AssociationRequestStatus.Approved ? NotificationType.Info : NotificationType.Alert,
            TargetRole = string.Empty,
            TargetUserId = request.RequesterUserId,
            CondominiumId = request.TargetCondominiumId,
            SentAt = DateTime.UtcNow,
            IsRead = false,
        };

        await _notificationRepository.AddAsync(notification);
        await _notificationRepository.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        return MapToDto(request);
    }

    private async Task<bool> IsReviewerAuthorizedAsync(Guid reviewerUserId, Guid reviewerCondominiumId)
    {
        var reviewer = await _userRepository.GetByIdAsync(reviewerUserId);
        if (reviewer == null || !reviewer.IsActive || reviewer.Role != UserRole.Admin)
        {
            return false;
        }

        var canManageCondominium = await _userCondominiumRepository.ExistsAsync(uc =>
            uc.UserId == reviewerUserId &&
            uc.CondominiumId == reviewerCondominiumId &&
            uc.CanManage);

        return canManageCondominium;
    }

    private static bool IsValidRequestedRole(AssociationRequestedRole requestedRole)
        => requestedRole == AssociationRequestedRole.Admin || requestedRole == AssociationRequestedRole.Resident;

    private static string? NormalizeCorrelationId(string? correlationId)
    {
        if (string.IsNullOrWhiteSpace(correlationId))
        {
            return null;
        }

        return correlationId.Trim().Length > 128
            ? correlationId.Trim()[..128]
            : correlationId.Trim();
    }

    private static string? NormalizeReason(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            return null;
        }

        var trimmed = reason.Trim();
        return trimmed.Length > 1000 ? trimmed[..1000] : trimmed;
    }

    private static AssociationRequestResponseDto MapToDto(UserCondominiumAssociationRequest request)
    {
        return new AssociationRequestResponseDto
        {
            Id = request.Id,
            RequesterUserId = request.RequesterUserId,
            TargetCondominiumId = request.TargetCondominiumId,
            RequestedRole = request.RequestedRole,
            Status = request.Status,
            Source = request.Source,
            RequestedAt = request.RequestedAt,
            ReviewedAt = request.ReviewedAt,
            ReviewedByUserId = request.ReviewedByUserId,
            ReviewReason = request.ReviewReason,
            CorrelationId = request.CorrelationId,
            CreatedAt = request.CreatedAt,
            UpdatedAt = request.UpdatedAt,
        };
    }
}

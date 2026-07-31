namespace Habitus.Domain.Entities;

public enum AssociationRequestedRole
{
    Admin = 1,
    Resident = 2,
}

public enum AssociationRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Cancelled = 3,
}

public enum AssociationRequestSource
{
    ManagerInviteLink = 0,
    RegisterFallback = 1,
    Manual = 2,
}

public class UserCondominiumAssociationRequest
{
    public Guid Id { get; set; }

    public Guid RequesterUserId { get; set; }
    public User RequesterUser { get; set; } = null!;

    public Guid TargetCondominiumId { get; set; }
    public Condominium TargetCondominium { get; set; } = null!;

    public AssociationRequestedRole RequestedRole { get; set; }
    public AssociationRequestStatus Status { get; set; } = AssociationRequestStatus.Pending;
    public AssociationRequestSource Source { get; set; } = AssociationRequestSource.Manual;

    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ReviewedAt { get; set; }

    public Guid? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }

    public string? ReviewReason { get; set; }
    public string? CorrelationId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

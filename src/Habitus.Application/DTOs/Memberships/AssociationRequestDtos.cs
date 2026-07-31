using Habitus.Domain.Entities;

namespace Habitus.Application.DTOs.Memberships;

public sealed class CreateAssociationRequestDto
{
    public Guid TargetCondominiumId { get; set; }
    public AssociationRequestedRole RequestedRole { get; set; }
    public AssociationRequestSource Source { get; set; } = AssociationRequestSource.Manual;
    public string? CorrelationId { get; set; }
}

public sealed class AssociationRequestResponseDto
{
    public Guid Id { get; set; }
    public Guid RequesterUserId { get; set; }
    public Guid TargetCondominiumId { get; set; }
    public AssociationRequestedRole RequestedRole { get; set; }
    public AssociationRequestStatus Status { get; set; }
    public AssociationRequestSource Source { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public string? ReviewReason { get; set; }
    public string? CorrelationId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class ReviewAssociationRequestDto
{
    public string? Reason { get; set; }
}

public sealed class AssociationConflictErrorDto
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

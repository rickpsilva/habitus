namespace Habitus.Application.DTOs.Memberships;

/// <summary>Represents a single unit membership row for a user.</summary>
public class UnitMembershipDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid UnitId { get; set; }
    public Guid CondominiumId { get; set; }
    public bool IsPrimary { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Payload to create a new unit membership.</summary>
public class CreateUnitMembershipRequest
{
    public Guid UserId { get; set; }
    public Guid UnitId { get; set; }
    public Guid CondominiumId { get; set; }
    public bool IsPrimary { get; set; }
}

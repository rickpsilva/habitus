namespace Habitus.Domain.Entities;

/// <summary>
/// Associates a user with a specific unit (fraction) within a condominium.
/// A user may hold several memberships (multiple fractions across one or more
/// condominiums). Exactly one membership per <c>{UserId, CondominiumId}</c> is
/// flagged as <see cref="IsPrimary"/>. <see cref="CondominiumId"/> is denormalized
/// from the owning <see cref="Unit"/> to keep tenant-scope filtering cheap.
/// </summary>
public class UnitMembership
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid UnitId { get; set; }
    public Unit Unit { get; set; } = null!;

    /// <summary>Denormalized from <see cref="Unit"/> for scope filtering; must equal <c>Unit.CondominiumId</c>.</summary>
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;

    /// <summary>Marks the user's primary fraction within the condominium. One per <c>{UserId, CondominiumId}</c>.</summary>
    public bool IsPrimary { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

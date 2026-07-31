namespace Habitus.Application.DTOs.Memberships;

/// <summary>
/// Aggregated view of the condominiums and units a user belongs to, plus the
/// currently active context. Used to drive active-context selection in the client.
/// </summary>
public class MembershipsDto
{
    public List<MembershipCondominiumDto> Condominiums { get; set; } = new();
    public ActiveContextDto ActiveContext { get; set; } = new();
}

public class MembershipCondominiumDto
{
    public Guid CondominiumId { get; set; }
    public string CondominiumName { get; set; } = string.Empty;
    public List<MembershipUnitDto> Units { get; set; } = new();
}

public class MembershipUnitDto
{
    public Guid UnitId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
}

public class ActiveContextDto
{
    public Guid? CondominiumId { get; set; }
    public Guid? UnitId { get; set; }
}

/// <summary>Request body for switching the active condominium/unit context.</summary>
public class SetActiveContextRequest
{
    public Guid CondominiumId { get; set; }
    public Guid? UnitId { get; set; }
}

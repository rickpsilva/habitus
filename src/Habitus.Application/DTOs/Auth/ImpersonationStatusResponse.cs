namespace Habitus.Application.DTOs.Auth;

/// <summary>
/// Response for checking current impersonation status.
/// </summary>
public class ImpersonationStatusResponse
{
    /// <summary>
    /// Whether the current session is an impersonation session.
    /// </summary>
    public bool IsImpersonating { get; set; }

    /// <summary>
    /// The impersonated user's ID (if impersonating).
    /// </summary>
    public Guid? ImpersonatedUserId { get; set; }

    /// <summary>
    /// The impersonated user's role (if impersonating).
    /// </summary>
    public int? ImpersonatedRole { get; set; }

    /// <summary>
    /// The impersonated user's name (if impersonating).
    /// </summary>
    public string? ImpersonatedUserName { get; set; }

    /// <summary>
    /// The condominium ID for the impersonation context.
    /// </summary>
    public Guid? CondominiumId { get; set; }

    /// <summary>
    /// The condominium name for the impersonation context.
    /// </summary>
    public string? CondominiumName { get; set; }

    /// <summary>
    /// Optional unit ID for the impersonation context.
    /// </summary>
    public Guid? UnitId { get; set; }

    /// <summary>
    /// Optional unit identifier (e.g., unit number) for the impersonation context.
    /// </summary>
    public string? UnitIdentifier { get; set; }

    /// <summary>
    /// When the impersonation expires (if impersonating) as Unix timestamp.
    /// </summary>
    public long? ExpiresAt { get; set; }

    /// <summary>
    /// The original Manager's user ID.
    /// </summary>
    public Guid? ImpersonatorUserId { get; set; }

    /// <summary>
    /// The original Manager's name.
    /// </summary>
    public string? ImpersonatorUserName { get; set; }
}
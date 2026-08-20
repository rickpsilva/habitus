namespace Habitus.Application.DTOs.Auth;

/// <summary>
/// Response when starting an impersonation session.
/// </summary>
public class ImpersonationResponse
{
    /// <summary>
    /// The impersonation JWT token.
    /// </summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// When the impersonation token expires (Unix timestamp).
    /// </summary>
    public long ExpiresAt { get; set; }

    /// <summary>
    /// The ID of the user being impersonated.
    /// </summary>
    public Guid ImpersonatedUserId { get; set; }

    /// <summary>
    /// The role of the impersonated user (1=Admin, 2=Resident).
    /// </summary>
    public int ImpersonatedRole { get; set; }

    /// <summary>
    /// The condominium ID for the impersonation context.
    /// </summary>
    public Guid CondominiumId { get; set; }

    /// <summary>
    /// Optional unit ID for the impersonation context.
    /// </summary>
    public Guid? UnitId { get; set; }

    /// <summary>
    /// Display name of the impersonated user.
    /// </summary>
    public string ImpersonatedUserName { get; set; } = string.Empty;

    /// <summary>
    /// The name of the condominium.
    /// </summary>
    public string CondominiumName { get; set; } = string.Empty;

    /// <summary>
    /// Optional unit identifier for display.
    /// </summary>
    public string? UnitIdentifier { get; set; }
}
namespace Habitus.Application.DTOs.Auth;

/// <summary>
/// Request to start an impersonation session.
/// </summary>
public class StartImpersonationRequest
{
    /// <summary>
    /// The ID of the target user to impersonate (must be Admin or Resident).
    /// </summary>
    public Guid TargetUserId { get; set; }

    /// <summary>
    /// Optional specific unit within the condominium to scope the impersonation.
    /// If not provided, the impersonation covers the user's primary condominium context.
    /// </summary>
    public Guid? UnitId { get; set; }
}
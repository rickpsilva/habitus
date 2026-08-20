namespace Habitus.Application.DTOs.Auth;

public class RepairEmailHashesRequest
{
    /// <summary>
    /// Specific email address to repair. If null or empty, every active user
    /// with a missing email hash will be repaired.
    /// </summary>
    public string? Email { get; set; }
}

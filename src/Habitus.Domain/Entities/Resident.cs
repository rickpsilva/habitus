namespace Habitus.Domain.Entities;

/// <summary>
/// Represents a resident's relationship to a unit.
/// DEPRECATED: This entity is being phased out in favor of User entity.
/// Kept for backward compatibility during migration.
/// </summary>
[Obsolete("Use User entity instead. This will be removed in a future version.")]
public class Resident
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiry { get; set; }
    public Guid UnitId { get; set; }
    public string Role { get; set; } = "Resident";  // Changed from enum to string for compatibility
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Unit Unit { get; set; } = null!;
}

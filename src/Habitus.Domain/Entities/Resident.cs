namespace Habitus.Domain.Entities;

public enum ResidentRole { Admin, Resident, Manager }

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
    public ResidentRole Role { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Unit Unit { get; set; } = null!;
}

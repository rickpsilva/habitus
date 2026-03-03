namespace Habitus.Domain.Entities;

public enum UserRole 
{ 
    Manager,  // Platform-level, can manage multiple condominiums
    Admin,    // Condominium-level, manages one condominium
    Resident  // Unit-level, resident of a unit
}

public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiry { get; set; }
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    
    // For Admins - single condominium they manage
    // For Residents - the primary condominium they belong to
    // For Managers - null (they manage multiple condominiums)
    public Guid? CondominiumId { get; set; }
    public Condominium? Condominium { get; set; }
    
    // For Residents - optional link to their unit
    // For Admins and Managers - typically null
    public Guid? UnitId { get; set; }
    public Unit? Unit { get; set; }
    
    // Many-to-many: Managers can have access to multiple condominiums
    public ICollection<UserCondominium> UserCondominiums { get; set; } = new List<UserCondominium>();
}

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
    public string? EmailHash { get; set; }  // SHA256 hash of email for unique index and fast login (new field)
    public string Phone { get; set; } = string.Empty;  // DEPRECATED: Use PhoneEncrypted instead (kept for legacy compatibility)
    public string? PhoneEncrypted { get; set; }  // Encrypted phone number (new field)
    public string PasswordHash { get; set; } = string.Empty;
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiry { get; set; }
    public bool TwoFactorEnabled { get; set; }
    public string? TwoFactorSecretEncrypted { get; set; }
    public DateTime? TwoFactorConfirmedAt { get; set; }
    public int FailedLoginCount { get; set; }
    public DateTime? LockoutUntil { get; set; }
    public DateTime? LastPasswordChangedAt { get; set; }
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
    public ICollection<UserAuthProvider> AuthProviders { get; set; } = new List<UserAuthProvider>();
    public ICollection<UserRecoveryCode> RecoveryCodes { get; set; } = new List<UserRecoveryCode>();
    public ICollection<AuthChallenge> AuthChallenges { get; set; } = new List<AuthChallenge>();
    
    // GDPR and Soft Delete
    public DateTime? GdprErasureRequestedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletionReason { get; set; }
}

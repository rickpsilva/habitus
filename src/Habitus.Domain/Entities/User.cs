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
    public string? EmailEncrypted { get; set; }
    public string? EmailHash { get; set; }
    public string? PhoneEncrypted { get; set; }
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

    // GDPR/RGPD Art. 17 erasure: anonymize-in-place marker. When true the row's PII has been
    // scrubbed and the account is retired (login is also blocked via IsActive=false).
    public bool IsAnonymized { get; set; }
    public DateTime? AnonymizedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    // Preferred UI language ("pt" or "en"); null means "use the condominium default language".
    public string? PreferredLanguage { get; set; }
    
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

    // Multi-fraction membership: a user may belong to several units across condominiums
    public ICollection<UnitMembership> UnitMemberships { get; set; } = new List<UnitMembership>();
    public ICollection<UserAuthProvider> AuthProviders { get; set; } = new List<UserAuthProvider>();
    public ICollection<UserRecoveryCode> RecoveryCodes { get; set; } = new List<UserRecoveryCode>();
    public ICollection<AuthChallenge> AuthChallenges { get; set; } = new List<AuthChallenge>();

    // Append-only GDPR/RGPD consent history for this user.
    public ICollection<UserConsent> UserConsents { get; set; } = new List<UserConsent>();
}

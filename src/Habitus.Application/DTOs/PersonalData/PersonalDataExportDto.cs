namespace Habitus.Application.DTOs.PersonalData;

/// <summary>
/// GDPR/RGPD Article 20 data-portability export for a single data subject. Contains only the
/// subject's own personal data (profile, memberships, consent history and subject-scoped records),
/// never another user's data and never secrets (no password hash, 2FA secret or reset tokens).
/// </summary>
public class PersonalDataExportDto
{
    public ExportMetadataDto ExportMetadata { get; set; } = new();
    public ProfileDto Profile { get; set; } = new();
    public List<MembershipExportDto> Memberships { get; set; } = new();
    public List<ConsentExportDto> Consents { get; set; } = new();
    public RecordsDto Records { get; set; } = new();
}

/// <summary>Provenance metadata describing when and for whom the export was generated.</summary>
public class ExportMetadataDto
{
    public DateTime GeneratedAt { get; set; }
    public Guid SubjectUserId { get; set; }
    public List<Guid> CondominiumScope { get; set; } = new();
    public string SchemaVersion { get; set; } = "1.0";
}

/// <summary>The subject's identity/profile. Email and phone are decrypted; no secrets are included.</summary>
public class ProfileDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? PreferredLanguage { get; set; }
    public List<ExternalLoginDto> ExternalLogins { get; set; } = new();
}

/// <summary>A linked external identity provider (no provider secrets, only the public linkage).</summary>
public class ExternalLoginDto
{
    public string Provider { get; set; } = string.Empty;
    public string ProviderEmail { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
}

/// <summary>A unit/condominium membership held by the subject.</summary>
public class MembershipExportDto
{
    public Guid CondominiumId { get; set; }
    public Guid UnitId { get; set; }
    public bool IsPrimary { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>A single consent decision from the subject's append-only consent history.</summary>
public class ConsentExportDto
{
    public string Key { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public bool Accepted { get; set; }
    public DateTime DecidedAt { get; set; }
}

/// <summary>Subject-scoped operational records (only rows created by / belonging to the subject).</summary>
public class RecordsDto
{
    public List<MaintenanceExportDto> MaintenanceRequests { get; set; } = new();
    public List<ReservationExportDto> Reservations { get; set; } = new();
    public List<PaymentExportDto> Payments { get; set; } = new();
}

public class MaintenanceExportDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

public class ReservationExportDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public Guid SpaceId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PaymentExportDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
    public DateTime? ProcessedDate { get; set; }
}

namespace Habitus.Application.DTOs.PersonalData;

/// <summary>The kind of erasure requested by a data subject.</summary>
public enum ErasureType
{
    /// <summary>Full anonymization of the account (Art. 17). Login is disabled.</summary>
    Full,
    /// <summary>Removal of specific non-retained fields only (v1: phone). Account stays active.</summary>
    Partial
}

/// <summary>
/// Request body for GDPR/RGPD Article 17 erasure. The subject must re-authenticate: a caller with
/// a password must supply <see cref="CurrentPassword"/>; a social-login-only caller (no password)
/// confirms with the typed <see cref="ConfirmationPhrase"/> alone. The phrase must equal the fixed
/// sentinel for erasure to proceed.
/// </summary>
public class ErasureRequestDto
{
    public ErasureType Type { get; set; }

    /// <summary>Must equal the fixed confirmation sentinel ("ELIMINAR") for erasure to proceed.</summary>
    public string ConfirmationPhrase { get; set; } = string.Empty;

    /// <summary>Required when the account has a password; ignored for social-login-only accounts.</summary>
    public string? CurrentPassword { get; set; }

    /// <summary>Fields to remove for a partial erasure (v1 accepts only "phone").</summary>
    public List<string>? Fields { get; set; }
}

/// <summary>Outcome of an erasure operation.</summary>
public class ErasureResultDto
{
    public ErasureType Type { get; set; }

    /// <summary>True when the account can no longer log in (full erasure disables login).</summary>
    public bool LoginDisabled { get; set; }

    public DateTime ProcessedAt { get; set; }
}

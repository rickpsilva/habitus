namespace Habitus.Application.DTOs.Consents;

/// <summary>The user's latest effective decision for a consent definition.</summary>
public enum ConsentDecision
{
    /// <summary>The user has never decided on this consent.</summary>
    None,
    /// <summary>The user's most recent decision was an acceptance.</summary>
    Accepted,
    /// <summary>The user's most recent decision was a withdrawal.</summary>
    Withdrawn
}

/// <summary>
/// Consent status for a user: the currently-active consent definitions (latest version per
/// key) paired with the user's latest decision, plus a convenience flag indicating whether
/// every mandatory consent is currently accepted.
/// </summary>
public class ConsentStatusDto
{
    public List<ConsentItemDto> Consents { get; set; } = new();
    public bool AllMandatoryAccepted { get; set; }
}

/// <summary>A single required/offered consent definition with the caller's latest decision.</summary>
public class ConsentItemDto
{
    public string Key { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Url { get; set; }
    public string? Body { get; set; }
    public bool IsMandatory { get; set; }
    public ConsentDecision Decision { get; set; }
    public DateTime? DecidedAt { get; set; }
}

/// <summary>Request body to record (append) a consent decision for the caller.</summary>
public class RecordConsentRequest
{
    public string Key { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public bool Accepted { get; set; }
}

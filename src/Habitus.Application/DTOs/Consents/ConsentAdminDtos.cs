namespace Habitus.Application.DTOs.Consents;

/// <summary>
/// Full view of a single <c>ConsentDefinition</c> for the Manager authoring area, including the
/// inline <see cref="Body"/> and audit fields so changes are attributable (REQ-SEC-008).
/// </summary>
public class ConsentDefinitionDto
{
    public Guid Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Url { get; set; }
    public string? Body { get; set; }
    public bool IsMandatory { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}

/// <summary>
/// In-place correction of an existing definition. Only <see cref="Title"/>, <see cref="Url"/> and
/// <see cref="Body"/> may change; <c>Key</c> and <c>Version</c> are preserved so users are not
/// re-prompted.
/// </summary>
public class UpdateConsentDefinitionRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Url { get; set; }
    public string? Body { get; set; }
}

/// <summary>
/// Publishes a new version of a consent <see cref="Key"/>. Because the latest active version per
/// key wins, this transparently forces re-consent for that key.
/// </summary>
public class PublishConsentVersionRequest
{
    public string Key { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Url { get; set; }
    public string? Body { get; set; }
    public bool IsMandatory { get; set; }
}

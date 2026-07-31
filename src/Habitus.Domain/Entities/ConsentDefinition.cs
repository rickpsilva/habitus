namespace Habitus.Domain.Entities;

/// <summary>
/// Catalog entry for a consent document (e.g. terms of use, privacy policy) that users
/// may be asked to accept. A given <see cref="Key"/> is versioned via <see cref="Version"/>;
/// the pair <c>{Key, Version}</c> is unique. "Currently required" consents are the active
/// (<see cref="IsActive"/>) mandatory (<see cref="IsMandatory"/>) definitions, taking the
/// latest active version per <see cref="Key"/> (by <see cref="CreatedAt"/>). Publishing a new
/// version therefore forces re-consent without mutating history.
/// </summary>
public class ConsentDefinition
{
    public Guid Id { get; set; }

    /// <summary>Stable identifier for the consent family (e.g. "terms", "privacy").</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>Document version (e.g. "1.0"). Unique together with <see cref="Key"/>.</summary>
    public string Version { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    /// <summary>Optional external link to the full document.</summary>
    public string? Url { get; set; }

    /// <summary>Optional inline document body.</summary>
    public string? Body { get; set; }

    /// <summary>When true, users must accept this consent before performing normal operations.</summary>
    public bool IsMandatory { get; set; }

    /// <summary>When false, the definition is retired and no longer required or offered.</summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Manager who created this definition (null for legacy/seeded rows).</summary>
    public Guid? CreatedByUserId { get; set; }

    /// <summary>When the definition was last corrected in place (null if never edited).</summary>
    public DateTime? UpdatedAt { get; set; }

    /// <summary>Manager who last corrected this definition in place (null if never edited).</summary>
    public Guid? UpdatedByUserId { get; set; }

    public ICollection<UserConsent> UserConsents { get; set; } = new List<UserConsent>();
}

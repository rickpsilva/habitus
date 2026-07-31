namespace Habitus.Domain.Entities;

/// <summary>
/// Append-only record of a user's decision (accept or withdraw) for a specific
/// <see cref="ConsentDefinition"/>. Rows are never updated: every accept or withdrawal is a
/// new row, so <see cref="DecidedAt"/> ordering yields a complete, auditable consent history.
/// The user's effective decision for a definition is the latest row by <see cref="DecidedAt"/>.
/// </summary>
public class UserConsent
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid ConsentDefinitionId { get; set; }
    public ConsentDefinition ConsentDefinition { get; set; } = null!;

    /// <summary>True for an acceptance, false for a withdrawal.</summary>
    public bool Accepted { get; set; }

    public DateTime DecidedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Client IP captured at decision time (audit/GDPR evidence). Optional.</summary>
    public string? IpAddress { get; set; }

    /// <summary>Client User-Agent captured at decision time (audit/GDPR evidence). Optional.</summary>
    public string? UserAgent { get; set; }
}

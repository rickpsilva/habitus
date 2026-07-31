namespace Habitus.Domain.Entities;

/// <summary>The kind of GDPR/RGPD data-subject request captured by a <see cref="PersonalDataRequest"/>.</summary>
public enum PersonalDataRequestType
{
    /// <summary>Article 20 data portability: the subject exported their personal data.</summary>
    Export,
    /// <summary>Article 17 erasure: full anonymization of the subject's account.</summary>
    ErasureFull,
    /// <summary>Article 17 erasure: removal of specific non-retained fields only.</summary>
    ErasurePartial
}

/// <summary>
/// Append-only audit record of a GDPR/RGPD data-subject request (export or erasure). Rows are
/// never updated or deleted: every request is a new row, giving a complete, auditable history of
/// who acted (<see cref="ActorUserId"/>) on whose data (<see cref="UserId"/>) and when. Mirrors the
/// append-only shape of <see cref="UserConsent"/>.
/// </summary>
public class PersonalDataRequest
{
    public Guid Id { get; set; }

    /// <summary>The data subject the request concerns.</summary>
    public Guid UserId { get; set; }

    /// <summary>The user who initiated the request (equals <see cref="UserId"/> for self-service).</summary>
    public Guid ActorUserId { get; set; }

    public PersonalDataRequestType RequestType { get; set; }

    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Client IP captured at request time (audit/GDPR evidence). Optional.</summary>
    public string? IpAddress { get; set; }

    /// <summary>Client User-Agent captured at request time (audit/GDPR evidence). Optional.</summary>
    public string? UserAgent { get; set; }
}

using Habitus.Application.DTOs.Consents;

namespace Habitus.Application.Interfaces;

/// <summary>
/// Manages GDPR/RGPD consent: exposes the currently-required consent definitions with the
/// caller's latest decision, appends new decisions to an immutable history, and answers whether
/// a user currently satisfies every mandatory consent (the signal that gates normal operations).
/// </summary>
public interface IConsentService
{
    /// <summary>
    /// Returns the active consent definitions (latest version per key) with the user's latest
    /// decision for each, plus a flag indicating whether all mandatory consents are accepted.
    /// </summary>
    Task<ConsentStatusDto> GetConsentStatusAsync(Guid userId);

    /// <summary>
    /// Appends a consent decision (accept/withdraw) for the caller. Never mutates prior rows.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Thrown when no active consent definition exists for the given key/version.
    /// </exception>
    Task RecordConsentAsync(Guid userId, string key, string version, bool accepted, string? ipAddress = null, string? userAgent = null);

    /// <summary>
    /// True only if, for every active mandatory definition (latest version per key), the user's
    /// most recent decision is an acceptance. Returns true when there are no mandatory definitions.
    /// </summary>
    Task<bool> HasAllMandatoryConsentsAsync(Guid userId);

    /// <summary>
    /// Lists every consent definition (all versions, active and retired) with full bodies and audit
    /// fields, for the Manager authoring area (REQ-SEC-008).
    /// </summary>
    Task<List<ConsentDefinitionDto>> ListDefinitionsAsync();

    /// <summary>
    /// Corrects a definition in place: changes only Title/Url/Body and stamps UpdatedAt/UpdatedByUserId.
    /// Never mutates Key/Version/CreatedAt, so it does not re-trigger the mandatory-consent gate.
    /// </summary>
    /// <exception cref="ConsentAuthoringException">Thrown (code <c>not_found</c>) when no definition has the given id.</exception>
    Task<ConsentDefinitionDto> UpdateDefinitionInPlaceAsync(Guid id, UpdateConsentDefinitionRequest req, Guid actingUserId);

    /// <summary>
    /// Publishes a new active definition for a key/version. Because the latest active version per key
    /// wins, this transparently forces re-consent; prior definitions and history are left intact.
    /// </summary>
    /// <exception cref="ConsentAuthoringException">Thrown (code <c>duplicate_version</c>) when the {Key, Version} already exists.</exception>
    Task<ConsentDefinitionDto> PublishNewVersionAsync(PublishConsentVersionRequest req, Guid actingUserId);
}

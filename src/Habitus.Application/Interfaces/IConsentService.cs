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
}

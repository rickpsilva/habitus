using Habitus.Application.DTOs.PersonalData;

namespace Habitus.Application.Interfaces;

/// <summary>
/// GDPR/RGPD self-service personal-data rights for a data subject: Article 20 export and
/// Article 17 erasure/anonymization. Methods are scope-parameterized (subject + actor) so a future
/// Manager-initiated path can reuse the same core without a redesign.
/// </summary>
public interface IPersonalDataService
{
    /// <summary>
    /// Builds the Article 20 portability export for <paramref name="subjectUserId"/>: profile
    /// (email/phone decrypted, no secrets), memberships, consent history and subject-scoped
    /// records intersected with the subject's condominium scope. Never returns other users' data.
    /// </summary>
    Task<PersonalDataExportDto> ExportAsync(Guid subjectUserId);

    /// <summary>
    /// Performs an Article 17 erasure for <paramref name="subjectUserId"/> after enforcing
    /// re-authentication and the confirmation-phrase gate, and appends an append-only
    /// <c>PersonalDataRequest</c> audit row. All writes are committed in a single transaction.
    /// </summary>
    /// <exception cref="ErasureValidationException">Thrown when the phrase or password check fails.</exception>
    Task<ErasureResultDto> EraseAsync(
        Guid subjectUserId,
        Guid actorUserId,
        ErasureType type,
        IReadOnlyList<string>? fields,
        string confirmationPhrase,
        string? currentPassword,
        string? ipAddress,
        string? userAgent);

    /// <summary>Appends an append-only <c>PersonalDataRequest</c> audit row (e.g. for an export).</summary>
    Task RecordRequestAsync(
        Guid subjectUserId,
        Guid actorUserId,
        Domain.Entities.PersonalDataRequestType type,
        string? ipAddress,
        string? userAgent);
}

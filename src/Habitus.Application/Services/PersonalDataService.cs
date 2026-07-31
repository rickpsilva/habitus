using Habitus.Application.DTOs.PersonalData;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

/// <summary>
/// Implements the GDPR/RGPD self-service personal-data rights (export + erasure). Aggregates the
/// subject's own data across several repositories that all share the same scoped DbContext, so the
/// erasure path commits every mutation in a single <c>SaveChangesAsync</c>.
/// </summary>
public class PersonalDataService : IPersonalDataService
{
    /// <summary>Fixed sentinel the caller must type to confirm an erasure.</summary>
    public const string ConfirmationSentinel = "ELIMINAR";

    /// <summary>Display name written to an anonymized user row.</summary>
    private const string AnonymizedName = "Unknown User";

    private readonly IRepository<User> _users;
    private readonly IRepository<UnitMembership> _memberships;
    private readonly IRepository<UserCondominium> _userCondominiums;
    private readonly IRepository<UserAuthProvider> _authProviders;
    private readonly IRepository<UserRecoveryCode> _recoveryCodes;
    private readonly IRepository<AuthChallenge> _authChallenges;
    private readonly IRepository<UserConsent> _consents;
    private readonly IRepository<MaintenanceRequest> _maintenance;
    private readonly IRepository<Reservation> _reservations;
    private readonly IRepository<Payment> _payments;
    private readonly IRepository<PersonalDataRequest> _requests;
    private readonly IEncryptionService _encryption;

    public PersonalDataService(
        IRepository<User> users,
        IRepository<UnitMembership> memberships,
        IRepository<UserCondominium> userCondominiums,
        IRepository<UserAuthProvider> authProviders,
        IRepository<UserRecoveryCode> recoveryCodes,
        IRepository<AuthChallenge> authChallenges,
        IRepository<UserConsent> consents,
        IRepository<MaintenanceRequest> maintenance,
        IRepository<Reservation> reservations,
        IRepository<Payment> payments,
        IRepository<PersonalDataRequest> requests,
        IEncryptionService encryption)
    {
        _users = users;
        _memberships = memberships;
        _userCondominiums = userCondominiums;
        _authProviders = authProviders;
        _recoveryCodes = recoveryCodes;
        _authChallenges = authChallenges;
        _consents = consents;
        _maintenance = maintenance;
        _reservations = reservations;
        _payments = payments;
        _requests = requests;
        _encryption = encryption;
    }

    public async Task<PersonalDataExportDto> ExportAsync(Guid subjectUserId)
    {
        var user = await _users.GetByIdAsync(subjectUserId)
            ?? throw new InvalidOperationException($"User {subjectUserId} not found.");

        var memberships = (await _memberships.FindAsync(m => m.UserId == subjectUserId)).ToList();
        var userCondominiums = (await _userCondominiums.FindAsync(uc => uc.UserId == subjectUserId)).ToList();
        var authProviders = (await _authProviders.FindAsync(p => p.UserId == subjectUserId)).ToList();
        var consents = (await _consents.FindWithIncludesAsync(c => c.UserId == subjectUserId, "ConsentDefinition")).ToList();

        // The subject's condominium scope: every condominium the subject is attached to. Used as a
        // defence-in-depth intersection so the export can never leak another tenant's records.
        var scope = new HashSet<Guid>();
        if (user.CondominiumId.HasValue) scope.Add(user.CondominiumId.Value);
        foreach (var m in memberships) scope.Add(m.CondominiumId);
        foreach (var uc in userCondominiums) scope.Add(uc.CondominiumId);

        var maintenance = (await _maintenance.FindAsync(m => m.CreatedBy == subjectUserId))
            .Where(m => scope.Contains(m.CondominiumId)).ToList();
        var reservations = (await _reservations.FindAsync(r => r.UserId == subjectUserId))
            .Where(r => scope.Contains(r.CondominiumId)).ToList();
        var payments = (await _payments.FindAsync(p => p.ResidentId == subjectUserId))
            .Where(p => scope.Contains(p.CondominiumId)).ToList();

        return new PersonalDataExportDto
        {
            ExportMetadata = new ExportMetadataDto
            {
                GeneratedAt = DateTime.UtcNow,
                SubjectUserId = subjectUserId,
                CondominiumScope = scope.OrderBy(id => id).ToList(),
                SchemaVersion = "1.0"
            },
            Profile = new ProfileDto
            {
                Name = user.Name,
                Email = DecryptEmail(user),
                Phone = DecryptPhone(user),
                PreferredLanguage = user.PreferredLanguage,
                ExternalLogins = authProviders.Select(p => new ExternalLoginDto
                {
                    Provider = p.ProviderType.ToString(),
                    ProviderEmail = p.ProviderEmail,
                    CreatedAt = p.CreatedAt,
                    LastUsedAt = p.LastUsedAt
                }).ToList()
            },
            Memberships = memberships.Select(m => new MembershipExportDto
            {
                CondominiumId = m.CondominiumId,
                UnitId = m.UnitId,
                IsPrimary = m.IsPrimary,
                CreatedAt = m.CreatedAt
            }).ToList(),
            Consents = consents
                .OrderBy(c => c.DecidedAt)
                .Select(c => new ConsentExportDto
                {
                    Key = c.ConsentDefinition?.Key ?? string.Empty,
                    Version = c.ConsentDefinition?.Version ?? string.Empty,
                    Title = c.ConsentDefinition?.Title ?? string.Empty,
                    Accepted = c.Accepted,
                    DecidedAt = c.DecidedAt
                }).ToList(),
            Records = new RecordsDto
            {
                MaintenanceRequests = maintenance.Select(m => new MaintenanceExportDto
                {
                    Id = m.Id,
                    CondominiumId = m.CondominiumId,
                    Title = m.Title,
                    Status = m.Status.ToString(),
                    Priority = m.Priority.ToString(),
                    CreatedAt = m.CreatedAt,
                    ResolvedAt = m.ResolvedAt
                }).ToList(),
                Reservations = reservations.Select(r => new ReservationExportDto
                {
                    Id = r.Id,
                    CondominiumId = r.CondominiumId,
                    SpaceId = r.SpaceId,
                    Status = r.Status.ToString(),
                    StartTime = r.StartTime,
                    EndTime = r.EndTime,
                    CreatedAt = r.CreatedAt
                }).ToList(),
                Payments = payments.Select(p => new PaymentExportDto
                {
                    Id = p.Id,
                    CondominiumId = p.CondominiumId,
                    Type = p.Type.ToString(),
                    Method = p.Method.ToString(),
                    Amount = p.Amount,
                    Status = p.Status.ToString(),
                    Description = p.Description,
                    CreatedDate = p.CreatedDate,
                    ProcessedDate = p.ProcessedDate
                }).ToList()
            }
        };
    }

    public async Task<ErasureResultDto> EraseAsync(
        Guid subjectUserId,
        Guid actorUserId,
        ErasureType type,
        IReadOnlyList<string>? fields,
        string confirmationPhrase,
        string? currentPassword,
        string? ipAddress,
        string? userAgent)
    {
        var user = await _users.GetByIdAsync(subjectUserId)
            ?? throw new InvalidOperationException($"User {subjectUserId} not found.");

        // Confirmation-phrase gate (applies to every erasure).
        if (!string.Equals(confirmationPhrase, ConfirmationSentinel, StringComparison.Ordinal))
        {
            throw new ErasureValidationException("invalid_confirmation_phrase",
                "The confirmation phrase is incorrect.");
        }

        // Re-authentication: password accounts must supply and match their current password;
        // social-login-only accounts (empty password hash) rely on the phrase alone.
        if (!string.IsNullOrEmpty(user.PasswordHash))
        {
            if (string.IsNullOrEmpty(currentPassword))
            {
                throw new ErasureValidationException("password_required",
                    "The current password is required to confirm erasure.");
            }
            if (!BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash))
            {
                throw new ErasureValidationException("invalid_password",
                    "The current password is incorrect.");
            }
        }

        var processedAt = DateTime.UtcNow;
        bool loginDisabled;

        if (type == ErasureType.Full)
        {
            AnonymizeFull(user, processedAt);
            await HardDeleteAssociationsAsync(subjectUserId);
            loginDisabled = true;
        }
        else
        {
            ErasePartial(user, fields);
            loginDisabled = false;
        }

        _users.Update(user);
        await _requests.AddAsync(new PersonalDataRequest
        {
            Id = Guid.NewGuid(),
            UserId = subjectUserId,
            ActorUserId = actorUserId,
            RequestType = type == ErasureType.Full
                ? PersonalDataRequestType.ErasureFull
                : PersonalDataRequestType.ErasurePartial,
            RequestedAt = processedAt,
            IpAddress = ipAddress,
            UserAgent = userAgent
        });

        // Single commit: user mutation, association deletes and the audit row persist atomically.
        await _users.SaveChangesAsync();

        return new ErasureResultDto
        {
            Type = type,
            LoginDisabled = loginDisabled,
            ProcessedAt = processedAt
        };
    }

    public async Task RecordRequestAsync(
        Guid subjectUserId,
        Guid actorUserId,
        PersonalDataRequestType type,
        string? ipAddress,
        string? userAgent)
    {
        await _requests.AddAsync(new PersonalDataRequest
        {
            Id = Guid.NewGuid(),
            UserId = subjectUserId,
            ActorUserId = actorUserId,
            RequestType = type,
            RequestedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            UserAgent = userAgent
        });
        await _requests.SaveChangesAsync();
    }

    /// <summary>Scrubs every PII/credential field on the user row and marks it anonymized-in-place.</summary>
    private static void AnonymizeFull(User user, DateTime processedAt)
    {
        user.Name = AnonymizedName;
        user.EmailEncrypted = null;
        user.EmailHash = null;
        user.PhoneEncrypted = null;
        user.PasswordHash = string.Empty;
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;
        user.TwoFactorEnabled = false;
        user.TwoFactorSecretEncrypted = null;
        user.TwoFactorConfirmedAt = null;
        user.PreferredLanguage = null;
        user.IsActive = false;
        user.IsAnonymized = true;
        user.AnonymizedAt = processedAt;
        user.UnitId = null;
        user.CondominiumId = null;
    }

    /// <summary>Removes only the requested non-retained fields (v1: phone). Account stays active.</summary>
    private static void ErasePartial(User user, IReadOnlyList<string>? fields)
    {
        if (fields is null) return;
        foreach (var field in fields)
        {
            if (string.Equals(field, "phone", StringComparison.OrdinalIgnoreCase))
            {
                user.PhoneEncrypted = null;
            }
        }
    }

    /// <summary>Hard-deletes the subject's association/auth rows (kept only for FK integrity where required).</summary>
    private async Task HardDeleteAssociationsAsync(Guid subjectUserId)
    {
        foreach (var m in await _memberships.FindAsync(m => m.UserId == subjectUserId)) _memberships.Remove(m);
        foreach (var uc in await _userCondominiums.FindAsync(uc => uc.UserId == subjectUserId)) _userCondominiums.Remove(uc);
        foreach (var p in await _authProviders.FindAsync(p => p.UserId == subjectUserId)) _authProviders.Remove(p);
        foreach (var r in await _recoveryCodes.FindAsync(r => r.UserId == subjectUserId)) _recoveryCodes.Remove(r);
        foreach (var c in await _authChallenges.FindAsync(c => c.UserId == subjectUserId)) _authChallenges.Remove(c);
    }

    private string DecryptEmail(User user)
        => string.IsNullOrWhiteSpace(user.EmailEncrypted)
            ? string.Empty
            : _encryption.Decrypt(user.EmailEncrypted);

    private string DecryptPhone(User user)
        => string.IsNullOrWhiteSpace(user.PhoneEncrypted)
            ? string.Empty
            : _encryption.Decrypt(user.PhoneEncrypted);
}

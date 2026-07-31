using Habitus.Application.DTOs.Consents;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

/// <summary>
/// Implements GDPR/RGPD consent as versioned <see cref="ConsentDefinition"/> definitions plus an
/// append-only <see cref="UserConsent"/> history. "Currently required" consents are the active,
/// mandatory definitions taking the latest version per <see cref="ConsentDefinition.Key"/> (by
/// <see cref="ConsentDefinition.CreatedAt"/>); publishing a newer version transparently forces
/// re-consent. A user satisfies the gate only when their latest decision for each required
/// definition is an acceptance.
/// </summary>
public class ConsentService : IConsentService
{
    private readonly IRepository<ConsentDefinition> _definitions;
    private readonly IRepository<UserConsent> _consents;

    public ConsentService(
        IRepository<ConsentDefinition> definitions,
        IRepository<UserConsent> consents)
    {
        _definitions = definitions;
        _consents = consents;
    }

    /// <inheritdoc />
    public async Task<ConsentStatusDto> GetConsentStatusAsync(Guid userId)
    {
        var active = await _definitions.FindAsync(d => d.IsActive);
        var latestPerKey = LatestVersionPerKey(active);

        var userConsents = (await _consents.FindAsync(c => c.UserId == userId)).ToList();

        var items = new List<ConsentItemDto>();
        var allMandatoryAccepted = true;

        foreach (var def in latestPerKey.OrderBy(d => d.Key, StringComparer.OrdinalIgnoreCase))
        {
            var decision = LatestDecision(userConsents, def.Id, out var decidedAt);

            if (def.IsMandatory && decision != ConsentDecision.Accepted)
            {
                allMandatoryAccepted = false;
            }

            items.Add(new ConsentItemDto
            {
                Key = def.Key,
                Version = def.Version,
                Title = def.Title,
                Url = def.Url,
                IsMandatory = def.IsMandatory,
                Decision = decision,
                DecidedAt = decidedAt
            });
        }

        return new ConsentStatusDto
        {
            Consents = items,
            AllMandatoryAccepted = allMandatoryAccepted
        };
    }

    /// <inheritdoc />
    public async Task RecordConsentAsync(Guid userId, string key, string version, bool accepted, string? ipAddress = null, string? userAgent = null)
    {
        var definition = await _definitions.FirstOrDefaultAsync(d =>
            d.Key == key && d.Version == version && d.IsActive)
            ?? throw new InvalidOperationException(
                $"No active consent definition exists for key '{key}' version '{version}'.");

        var entity = new UserConsent
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ConsentDefinitionId = definition.Id,
            Accepted = accepted,
            DecidedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            UserAgent = userAgent
        };

        await _consents.AddAsync(entity);
        await _consents.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task<bool> HasAllMandatoryConsentsAsync(Guid userId)
    {
        var mandatory = await _definitions.FindAsync(d => d.IsActive && d.IsMandatory);
        var required = LatestVersionPerKey(mandatory);
        if (required.Count == 0)
        {
            return true;
        }

        var userConsents = (await _consents.FindAsync(c => c.UserId == userId)).ToList();

        foreach (var def in required)
        {
            if (LatestDecision(userConsents, def.Id, out _) != ConsentDecision.Accepted)
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>Reduces a set of definitions to the latest version per key (by CreatedAt).</summary>
    private static List<ConsentDefinition> LatestVersionPerKey(IEnumerable<ConsentDefinition> definitions) =>
        definitions
            .GroupBy(d => d.Key)
            .Select(g => g.OrderByDescending(d => d.CreatedAt).First())
            .ToList();

    /// <summary>Returns the user's latest decision for a definition, or <see cref="ConsentDecision.None"/>.</summary>
    private static ConsentDecision LatestDecision(IEnumerable<UserConsent> userConsents, Guid definitionId, out DateTime? decidedAt)
    {
        var latest = userConsents
            .Where(c => c.ConsentDefinitionId == definitionId)
            .OrderByDescending(c => c.DecidedAt)
            .FirstOrDefault();

        decidedAt = latest?.DecidedAt;
        if (latest is null)
        {
            return ConsentDecision.None;
        }

        return latest.Accepted ? ConsentDecision.Accepted : ConsentDecision.Withdrawn;
    }
}

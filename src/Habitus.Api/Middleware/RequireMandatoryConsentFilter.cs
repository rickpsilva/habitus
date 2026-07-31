using System.Security.Claims;
using Habitus.Application.DTOs.Consents;
using Habitus.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Habitus.Api.Middleware;

/// <summary>
/// Global action filter that enforces GDPR/RGPD mandatory consent. For every AUTHENTICATED
/// request to a non-allow-listed controller action, it blocks with HTTP 451
/// (Unavailable For Legal Reasons) and a machine-readable body
/// <c>{ code: "consent_required", message, missing: [{ key, version, title }] }</c> until the
/// caller has accepted every currently-required mandatory consent.
/// <para>
/// The allow-list keeps users from being locked out: authentication/registration/2FA endpoints,
/// the consent endpoints themselves, and the multi-condominium context-selection endpoints remain
/// reachable so a user can log in, read what they must accept, accept it, and choose a context.
/// Swagger, health checks and static/uploads are served outside the MVC action pipeline and so are
/// never reached by this filter, but their prefixes are listed for defence in depth.
/// </para>
/// The happy path performs a single existence check (<see cref="IConsentService.HasAllMandatoryConsentsAsync"/>);
/// the detailed <c>missing</c> list is only built when the caller is actually blocked.
/// </summary>
public sealed class RequireMandatoryConsentFilter : IAsyncActionFilter
{
    // Path prefixes that must never be gated, otherwise a consent-less user could not recover.
    private static readonly string[] AllowedPathPrefixes =
    [
        "/api/platform/auth",            // login, register, refresh, logout, 2FA, external providers
        "/api/platform/me/consents",     // read + record consent decisions
        "/api/platform/me/memberships",  // context selection: list memberships
        "/api/platform/me/active-context", // context selection: switch active context
        "/api/platform/me/export",       // GDPR Art. 20 export (data-subject right, must not be gated)
        "/api/platform/me/personal-data", // GDPR Art. 17 erasure (data-subject right, must not be gated)
        "/swagger",                      // API docs (not an MVC action, listed defensively)
        "/health",                       // health checks (not an MVC action, listed defensively)
        "/uploads",                      // static uploads (not an MVC action, listed defensively)
    ];

    private readonly IConsentService _consentService;

    public RequireMandatoryConsentFilter(IConsentService consentService) => _consentService = consentService;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            await next();
            return;
        }

        var path = context.HttpContext.Request.Path.Value ?? string.Empty;
        if (IsAllowListed(path))
        {
            await next();
            return;
        }

        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            await next();
            return;
        }

        if (await _consentService.HasAllMandatoryConsentsAsync(userId))
        {
            await next();
            return;
        }

        var status = await _consentService.GetConsentStatusAsync(userId);
        var missing = status.Consents
            .Where(c => c.IsMandatory && c.Decision != ConsentDecision.Accepted)
            .Select(c => new { c.Key, c.Version, c.Title })
            .ToList();

        context.Result = new ObjectResult(new
        {
            code = "consent_required",
            message = "You must accept the required consents before continuing.",
            missing
        })
        {
            StatusCode = StatusCodes.Status451UnavailableForLegalReasons
        };
    }

    private static bool IsAllowListed(string path) =>
        AllowedPathPrefixes.Any(prefix => path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
}

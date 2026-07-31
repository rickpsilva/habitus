using Habitus.Application.DTOs.Consents;
using Habitus.Application.DTOs.Localization;
using Habitus.Application.DTOs.Memberships;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/platform/me")]
[Authorize]
public class MeController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly IConsentService _consentService;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<LocalizationSettings> _localizationRepository;
    private readonly IFeatureEntitlementService _featureEntitlementService;

    public MeController(
        AuthService authService,
        IConsentService consentService,
        IRepository<User> userRepository,
        IRepository<LocalizationSettings> localizationRepository,
        IFeatureEntitlementService featureEntitlementService)
    {
        _authService = authService;
        _consentService = consentService;
        _userRepository = userRepository;
        _localizationRepository = localizationRepository;
        _featureEntitlementService = featureEntitlementService;
    }

    [HttpGet("memberships")]
    public async Task<IActionResult> GetMemberships()
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _authService.GetMembershipsAsync(userId);
        return Ok(result);
    }

    [HttpPost("active-context")]
    public async Task<IActionResult> SetActiveContext([FromBody] SetActiveContextRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await _authService.SetActiveContextAsync(userId, request.CondominiumId, request.UnitId);
            if (result == null) return Unauthorized();
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InactiveCondominiumAccessException)
        {
            return StatusCode(StatusCodes.Status423Locked, new
            {
                code = "condominium_inactive",
                message = "Condominium is inactive. Please contact your condominium administrator."
            });
        }
    }

    [HttpGet("consents")]
    public async Task<IActionResult> GetConsents()
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _consentService.GetConsentStatusAsync(userId);
        return Ok(result);
    }

    [HttpPost("consents")]
    public async Task<IActionResult> RecordConsent([FromBody] RecordConsentRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();
            await _consentService.RecordConsentAsync(
                userId, request.Key, request.Version, request.Accepted,
                ipAddress, string.IsNullOrWhiteSpace(userAgent) ? null : userAgent);

            var status = await _consentService.GetConsentStatusAsync(userId);
            return Ok(status);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { code = "invalid_consent", message = ex.Message });
        }
    }

    /// <summary>
    /// Localization view for the caller: whether their active condominium's plan grants the
    /// multilanguage entitlement, their stored preference, the platform default language and the
    /// supported languages (REQ-I18N-001).
    /// </summary>
    [HttpGet("localization")]
    public async Task<IActionResult> GetLocalization()
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            return Unauthorized();
        }

        var multilanguageEnabled = await IsMultilanguageEnabledForActiveContextAsync();

        return Ok(new MeLocalizationDto
        {
            MultilanguageEnabled = multilanguageEnabled,
            PreferredLanguage = user.PreferredLanguage,
            DefaultLanguage = await GetPlatformDefaultLanguageAsync(),
            SupportedLanguages = LocalizationLanguages.Supported
        });
    }

    /// <summary>
    /// Persist the caller's preferred language (REQ-I18N-001). Rejects unsupported languages and
    /// only allows a preference when the active condominium's plan grants multilanguage.
    /// </summary>
    [HttpPut("language")]
    public async Task<IActionResult> SetLanguage([FromBody] SetLanguageRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        if (!LocalizationLanguages.IsSupported(request.Language))
        {
            return BadRequest(new { code = "invalid_language", message = "Unsupported language." });
        }

        if (!await IsMultilanguageEnabledForActiveContextAsync())
        {
            return BadRequest(new
            {
                code = "multilanguage_disabled",
                message = "Multilanguage is not available for the current subscription."
            });
        }

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            return Unauthorized();
        }

        user.PreferredLanguage = request.Language.Trim().ToLowerInvariant();
        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        return Ok(new MeLocalizationDto
        {
            MultilanguageEnabled = true,
            PreferredLanguage = user.PreferredLanguage,
            DefaultLanguage = await GetPlatformDefaultLanguageAsync(),
            SupportedLanguages = LocalizationLanguages.Supported
        });
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdClaim, out userId);
    }

    /// <summary>
    /// Resolves whether the caller's active condominium (from the <c>CondominiumId</c> claim) has
    /// the multilanguage entitlement via its active plan. Returns false when there is no active
    /// condominium.
    /// </summary>
    private async Task<bool> IsMultilanguageEnabledForActiveContextAsync()
    {
        var condominiumIdClaim = User.FindFirstValue("CondominiumId");
        if (!Guid.TryParse(condominiumIdClaim, out var condominiumId))
        {
            return false;
        }

        return await _featureEntitlementService.IsFeatureEnabledForCondominiumAsync(condominiumId, "multilanguage");
    }

    /// <summary>Returns the platform-wide default language, falling back to "pt" when unset.</summary>
    private async Task<string> GetPlatformDefaultLanguageAsync()
    {
        var settings = (await _localizationRepository.GetAllAsync()).FirstOrDefault();
        return settings?.DefaultLanguage ?? LocalizationLanguages.Default;
    }
}

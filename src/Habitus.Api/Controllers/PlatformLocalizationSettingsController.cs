using Habitus.Application.DTOs.Localization;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

/// <summary>
/// Platform-wide localization settings (REQ-I18N-001). A single global row holds the default
/// language used as the fallback whenever multilanguage is not available. Any authenticated user
/// may read it so the UI knows the fallback language; only a Manager may change it.
/// </summary>
[ApiController]
[Route("api/platform/localization-settings")]
[Authorize]
public class PlatformLocalizationSettingsController : ControllerBase
{
    private readonly IRepository<LocalizationSettings> _repository;
    private readonly ILogger<PlatformLocalizationSettingsController> _logger;

    public PlatformLocalizationSettingsController(
        IRepository<LocalizationSettings> repository,
        ILogger<PlatformLocalizationSettingsController> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    /// <summary>
    /// Get the platform-wide localization settings. Returns defaults (default language "pt",
    /// <see cref="Guid.Empty"/> Id) when no row has been created yet.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var settings = (await _repository.GetAllAsync()).FirstOrDefault();

        if (settings == null)
        {
            return Ok(new PlatformLocalizationSettingsDto
            {
                Id = Guid.Empty,
                DefaultLanguage = LocalizationLanguages.Default,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        return Ok(ToDto(settings));
    }

    /// <summary>
    /// Intentionally anonymous endpoint that returns ONLY the platform-wide default language so the
    /// pre-auth UI (e.g. the login page, which has no JWT) can localize itself. It exposes no other
    /// settings data (no Id/timestamps) and falls back to <see cref="LocalizationLanguages.Default"/>
    /// when no row exists.
    /// </summary>
    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicDefault()
    {
        var settings = (await _repository.GetAllAsync()).FirstOrDefault();

        return Ok(new PublicLocalizationDefaultDto
        {
            DefaultLanguage = settings?.DefaultLanguage ?? LocalizationLanguages.Default
        });
    }

    /// <summary>
    /// Set the platform-wide default language (REQ-I18N-001). Restricted to Manager only; upserts
    /// the single global row. Rejects unsupported languages with 400 <c>invalid_language</c>.
    /// </summary>
    [HttpPut]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Update([FromBody] UpdatePlatformLocalizationSettingsRequest request)
    {
        if (!LocalizationLanguages.IsSupported(request.DefaultLanguage))
        {
            return BadRequest(new { code = "invalid_language", message = "Unsupported default language." });
        }

        var settings = (await _repository.GetAllAsync()).FirstOrDefault();
        var isNew = settings == null;
        settings ??= new LocalizationSettings
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        };

        settings.DefaultLanguage = request.DefaultLanguage.Trim().ToLowerInvariant();
        settings.UpdatedAt = DateTime.UtcNow;

        if (isNew)
        {
            await _repository.AddAsync(settings);
        }
        else
        {
            _repository.Update(settings);
        }

        await _repository.SaveChangesAsync();
        _logger.LogInformation("Platform default language updated to {Default}", settings.DefaultLanguage);

        return Ok(ToDto(settings));
    }

    private static PlatformLocalizationSettingsDto ToDto(LocalizationSettings settings) => new()
    {
        Id = settings.Id,
        DefaultLanguage = settings.DefaultLanguage,
        CreatedAt = settings.CreatedAt,
        UpdatedAt = settings.UpdatedAt
    };
}

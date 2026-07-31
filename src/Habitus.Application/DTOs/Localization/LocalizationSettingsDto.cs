namespace Habitus.Application.DTOs.Localization;

/// <summary>Platform-wide localization settings (single global row) returned to callers.</summary>
public class PlatformLocalizationSettingsDto
{
    public Guid Id { get; set; }
    public string DefaultLanguage { get; set; } = LocalizationLanguages.Default;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Non-sensitive projection of the platform localization settings exposing only the default
/// language, safe to return to unauthenticated callers (e.g. the pre-auth login page).
/// </summary>
public class PublicLocalizationDefaultDto
{
    public string DefaultLanguage { get; set; } = LocalizationLanguages.Default;
}

/// <summary>Request to set the platform-wide default language.</summary>
public class UpdatePlatformLocalizationSettingsRequest
{
    /// <summary>The platform default language; must be a supported code (see <see cref="LocalizationLanguages"/>).</summary>
    public string DefaultLanguage { get; set; } = LocalizationLanguages.Default;
}

/// <summary>Localization view for the current caller (their preference + condominium context).</summary>
public class MeLocalizationDto
{
    public bool MultilanguageEnabled { get; set; }
    public string? PreferredLanguage { get; set; }
    public string DefaultLanguage { get; set; } = LocalizationLanguages.Default;
    public string[] SupportedLanguages { get; set; } = LocalizationLanguages.Supported;
}

/// <summary>Request to set the current caller's preferred language.</summary>
public class SetLanguageRequest
{
    public string Language { get; set; } = string.Empty;
}

namespace Habitus.Application.DTOs.Localization;

/// <summary>
/// Single source of truth for the languages the platform supports and the platform-wide
/// default. Keeping the catalog here avoids duplicating the supported-language list across
/// controllers and tests.
/// </summary>
public static class LocalizationLanguages
{
    /// <summary>Platform-wide default language used when nothing more specific is configured.</summary>
    public const string Default = "pt";

    /// <summary>Language codes the platform currently supports.</summary>
    public static readonly string[] Supported = { "pt", "en" };

    /// <summary>Returns true when <paramref name="language"/> is a supported language code.</summary>
    public static bool IsSupported(string? language) =>
        !string.IsNullOrWhiteSpace(language) &&
        Array.Exists(Supported, l => string.Equals(l, language, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Normalizes an optional requested default language to a supported, lower-cased code,
    /// falling back to <see cref="Default"/> when the value is null, blank or unsupported.
    /// </summary>
    public static string NormalizeDefaultOrFallback(string? language) =>
        IsSupported(language) ? language!.Trim().ToLowerInvariant() : Default;
}

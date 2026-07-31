using Habitus.Domain.Entities;

namespace Habitus.Application.Interfaces;

/// <summary>
/// Caches the four platform-wide, single-row settings tables that are read on many requests.
/// Only the detached (no-tracking) single row is ever cached, so returned instances must never be
/// mutated and saved. Write paths keep loading a tracked entity directly and call the matching
/// <c>Invalidate…</c> method after a successful save so the next read reflects the change.
/// </summary>
public interface IPlatformSettingsCache
{
    /// <summary>Gets the cached platform localization settings, or <c>null</c> when no row exists.</summary>
    Task<LocalizationSettings?> GetLocalizationAsync();

    /// <summary>Gets the cached platform billing settings, or <c>null</c> when no row exists.</summary>
    Task<PlatformBillingSettings?> GetBillingAsync();

    /// <summary>Gets the cached system email settings, or <c>null</c> when no row exists.</summary>
    Task<SystemEmailSettings?> GetSystemEmailAsync();

    /// <summary>Gets the cached platform upload settings, or <c>null</c> when no row exists.</summary>
    Task<PlatformUploadSettings?> GetUploadAsync();

    /// <summary>Evicts the cached platform localization settings.</summary>
    void InvalidateLocalization();

    /// <summary>Evicts the cached platform billing settings.</summary>
    void InvalidateBilling();

    /// <summary>Evicts the cached system email settings.</summary>
    void InvalidateSystemEmail();

    /// <summary>Evicts the cached platform upload settings.</summary>
    void InvalidateUpload();
}

namespace Habitus.Application.Interfaces;

/// <summary>
/// Single source of truth for resolving whether a condominium's active subscription plan grants a
/// given feature entitlement. Encapsulates the resolution order: active subscription plan features
/// → active Free plan features → hardcoded free fallback set.
/// </summary>
public interface IFeatureEntitlementService
{
    /// <summary>
    /// Returns true when the condominium's effective plan has <paramref name="featureKey"/> enabled.
    /// The match is case-insensitive on the feature key and honours the <c>IsEnabled</c> flag.
    /// </summary>
    /// <param name="condominiumId">The condominium whose entitlement is being resolved.</param>
    /// <param name="featureKey">The feature key to check (e.g. <c>"multilanguage"</c>).</param>
    Task<bool> IsFeatureEnabledForCondominiumAsync(Guid condominiumId, string featureKey);
}

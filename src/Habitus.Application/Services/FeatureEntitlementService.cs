using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

/// <summary>
/// Resolves feature entitlements for a condominium from its active subscription plan, mirroring the
/// exact resolution order used by the API's feature gate: active <see cref="CondominiumSubscription"/>
/// (Status=Active, latest StartDate) → its plan's features → the active Free plan's features → a
/// hardcoded free fallback set. This is the single source of truth for entitlement checks.
/// </summary>
public class FeatureEntitlementService : IFeatureEntitlementService
{
    private static readonly HashSet<string> FreeFallbackFeatures =
    [
        "maintenance",
        "announcements",
        "documents",
    ];

    private readonly IRepository<CondominiumSubscription> _subscriptionsRepo;
    private readonly IRepository<SubscriptionPlan> _plansRepo;

    public FeatureEntitlementService(
        IRepository<CondominiumSubscription> subscriptionsRepo,
        IRepository<SubscriptionPlan> plansRepo)
    {
        _subscriptionsRepo = subscriptionsRepo;
        _plansRepo = plansRepo;
    }

    /// <inheritdoc />
    public async Task<bool> IsFeatureEnabledForCondominiumAsync(Guid condominiumId, string featureKey)
    {
        var activeSub = (await _subscriptionsRepo.FindWithIncludesAsync(
                s => s.CondominiumId == condominiumId && s.Status == SubscriptionStatus.Active,
                nameof(CondominiumSubscription.Plan),
                $"{nameof(CondominiumSubscription.Plan)}.{nameof(SubscriptionPlan.Features)}"))
            .OrderByDescending(s => s.StartDate)
            .FirstOrDefault();

        IEnumerable<PlanFeature> features;
        if (activeSub?.Plan?.Features?.Any() == true)
        {
            features = activeSub.Plan.Features;
        }
        else
        {
            var fallbackPlan = (await _plansRepo.FindWithIncludesAsync(
                    p => p.IsActive && p.Tier == PlanTier.Free,
                    nameof(SubscriptionPlan.Features)))
                .FirstOrDefault();

            features = fallbackPlan?.Features?.Any() == true
                ? fallbackPlan.Features
                : FreeFallbackFeatures.Select(k => new PlanFeature { FeatureKey = k, IsEnabled = true });
        }

        return features.Any(f =>
            f.IsEnabled &&
            string.Equals(f.FeatureKey, featureKey, StringComparison.OrdinalIgnoreCase));
    }
}

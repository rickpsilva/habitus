using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Habitus.Api.Middleware;

public sealed class RequireFeatureAttribute : TypeFilterAttribute
{
    public RequireFeatureAttribute(string featureKey) : base(typeof(RequireFeatureFilter))
    {
        Arguments = [featureKey];
    }
}

public sealed class RequireFeatureFilter : IAsyncActionFilter
{
    private static readonly HashSet<string> FreeFallbackFeatures =
    [
        "maintenance",
        "announcements",
        "documents",
    ];

    private readonly string _featureKey;
    private readonly IRepository<CondominiumSubscription> _subscriptionsRepo;
    private readonly IRepository<SubscriptionPlan> _plansRepo;

    public RequireFeatureFilter(
        string featureKey,
        IRepository<CondominiumSubscription> subscriptionsRepo,
        IRepository<SubscriptionPlan> plansRepo)
    {
        _featureKey = featureKey;
        _subscriptionsRepo = subscriptionsRepo;
        _plansRepo = plansRepo;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;

        if (user.IsInRole(UserRole.Manager.ToString()))
        {
            await next();
            return;
        }

        var condominiumClaim = user.FindFirst("CondominiumId")?.Value;
        if (!Guid.TryParse(condominiumClaim, out var condominiumId))
        {
            context.Result = new ForbidResult();
            return;
        }

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

        var enabled = features.Any(f =>
            f.IsEnabled &&
            string.Equals(f.FeatureKey, _featureKey, StringComparison.OrdinalIgnoreCase));

        if (!enabled)
        {
            context.Result = new ObjectResult(new { message = $"Feature '{_featureKey}' is not available for the current subscription." })
            {
                StatusCode = StatusCodes.Status403Forbidden,
            };
            return;
        }

        await next();
    }
}

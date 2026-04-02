using Habitus.Application.DTOs.Subscriptions;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class SubscriptionService
{
    private readonly IRepository<SubscriptionPlan> _plansRepo;
    private readonly IRepository<PlanFeature> _featuresRepo;
    private readonly IRepository<CondominiumSubscription> _subscriptionsRepo;
    private readonly IRepository<Condominium> _condominiumsRepo;

    public SubscriptionService(
        IRepository<SubscriptionPlan> plansRepo,
        IRepository<PlanFeature> featuresRepo,
        IRepository<CondominiumSubscription> subscriptionsRepo,
        IRepository<Condominium> condominiumsRepo)
    {
        _plansRepo = plansRepo;
        _featuresRepo = featuresRepo;
        _subscriptionsRepo = subscriptionsRepo;
        _condominiumsRepo = condominiumsRepo;
    }

    public async Task<List<SubscriptionPlanDto>> GetAllPlansAsync()
    {
        var plans = await _plansRepo.FindWithIncludesAsync(p => p.IsActive, nameof(SubscriptionPlan.Features));
        return plans.OrderBy(p => p.Tier).Select(MapPlanToDto).ToList();
    }

    public async Task<SubscriptionPlanDto?> GetPlanByIdAsync(Guid id)
    {
        var plan = await _plansRepo.GetByIdWithIncludesAsync(id, nameof(SubscriptionPlan.Features));
        return plan is null ? null : MapPlanToDto(plan);
    }

    public async Task<List<CondominiumSubscriptionDto>> GetAllSubscriptionsAsync()
    {
        var subs = await _subscriptionsRepo.FindWithIncludesAsync(
            s => s.Status == SubscriptionStatus.Active,
            nameof(CondominiumSubscription.Plan),
            $"{nameof(CondominiumSubscription.Plan)}.{nameof(SubscriptionPlan.Features)}",
            nameof(CondominiumSubscription.Condominium));
        return subs.OrderBy(s => s.Condominium.Name).Select(MapSubToDto).ToList();
    }

    public async Task<CondominiumSubscriptionDto?> GetCondominiumSubscriptionAsync(Guid condominiumId)
    {
        var subs = await _subscriptionsRepo.FindWithIncludesAsync(
            s => s.CondominiumId == condominiumId && s.Status == SubscriptionStatus.Active,
            nameof(CondominiumSubscription.Plan),
            $"{nameof(CondominiumSubscription.Plan)}.{nameof(SubscriptionPlan.Features)}",
            nameof(CondominiumSubscription.Condominium));
        var sub = subs.FirstOrDefault();
        return sub is null ? null : MapSubToDto(sub);
    }

    public async Task<CondominiumSubscriptionDto> AssignSubscriptionAsync(AssignSubscriptionRequest request)
    {
        // Cancel any existing active subscription for this condominium
        var existing = await _subscriptionsRepo.FindAsync(
            s => s.CondominiumId == request.CondominiumId && s.Status == SubscriptionStatus.Active);
        foreach (var old in existing)
        {
            old.Status = SubscriptionStatus.Cancelled;
            old.EndDate = DateTime.UtcNow;
            old.UpdatedAt = DateTime.UtcNow;
            _subscriptionsRepo.Update(old);
        }

        var plan = await _plansRepo.GetByIdWithIncludesAsync(request.PlanId, nameof(SubscriptionPlan.Features))
            ?? throw new KeyNotFoundException($"Plan {request.PlanId} not found.");

        var condominium = await _condominiumsRepo.GetByIdAsync(request.CondominiumId)
            ?? throw new KeyNotFoundException($"Condominium {request.CondominiumId} not found.");

        if (!Enum.TryParse<BillingCycle>(request.BillingCycle, true, out var cycle))
            cycle = BillingCycle.Monthly;

        var price = cycle switch
        {
            BillingCycle.Annual => plan.PriceAnnual,
            BillingCycle.Quinquennial => plan.PriceQuinquennial,
            _ => plan.PriceMonthly,
        };

        var nextBilling = cycle switch
        {
            BillingCycle.Annual => DateTime.UtcNow.AddYears(1),
            BillingCycle.Quinquennial => DateTime.UtcNow.AddYears(5),
            _ => DateTime.UtcNow.AddMonths(1),
        };

        var newSub = new CondominiumSubscription
        {
            Id = Guid.NewGuid(),
            CondominiumId = request.CondominiumId,
            PlanId = request.PlanId,
            BillingCycle = cycle,
            Status = SubscriptionStatus.Active,
            StartDate = DateTime.UtcNow,
            NextBillingDate = nextBilling,
            PriceAtPurchase = price,
            CreatedAt = DateTime.UtcNow,
            Plan = plan,
            Condominium = condominium,
        };

        await _subscriptionsRepo.AddAsync(newSub);
        await _subscriptionsRepo.SaveChangesAsync();

        return MapSubToDto(newSub);
    }

    public async Task CancelSubscriptionAsync(Guid subscriptionId)
    {
        var sub = await _subscriptionsRepo.GetByIdAsync(subscriptionId)
            ?? throw new KeyNotFoundException($"Subscription {subscriptionId} not found.");
        sub.Status = SubscriptionStatus.Cancelled;
        sub.EndDate = DateTime.UtcNow;
        sub.UpdatedAt = DateTime.UtcNow;
        _subscriptionsRepo.Update(sub);
        await _subscriptionsRepo.SaveChangesAsync();
    }

    public async Task<SubscriptionStatsDto> GetStatsAsync()
    {
        var subs = (await _subscriptionsRepo.FindAsync(s => s.Status == SubscriptionStatus.Active)).ToList();
        var condominiums = await _condominiumsRepo.GetAllAsync();

        var monthlyVolume = subs.Sum(s => s.BillingCycle switch
        {
            BillingCycle.Annual => s.PriceAtPurchase / 12m,
            BillingCycle.Quinquennial => s.PriceAtPurchase / 60m,
            _ => s.PriceAtPurchase,
        });

        return new SubscriptionStatsDto
        {
            TotalCondominiums = condominiums.Count(),
            ActiveSubscriptions = subs.Count,
            MonthlyBillingVolume = Math.Round(monthlyVolume, 2),
        };
    }

    private static SubscriptionPlanDto MapPlanToDto(SubscriptionPlan plan) => new()
    {
        Id = plan.Id,
        Name = plan.Name,
        Tier = plan.Tier.ToString(),
        Description = plan.Description,
        PriceMonthly = plan.PriceMonthly,
        PriceAnnual = plan.PriceAnnual,
        PriceQuinquennial = plan.PriceQuinquennial,
        IsActive = plan.IsActive,
        Features = plan.Features.Select(f => new PlanFeatureDto
        {
            FeatureKey = f.FeatureKey,
            FeatureLabel = f.FeatureLabel,
        }).ToList(),
    };

    private static CondominiumSubscriptionDto MapSubToDto(CondominiumSubscription sub) => new()
    {
        Id = sub.Id,
        CondominiumId = sub.CondominiumId,
        CondominiumName = sub.Condominium?.Name ?? string.Empty,
        Plan = MapPlanToDto(sub.Plan),
        BillingCycle = sub.BillingCycle.ToString(),
        Status = sub.Status.ToString(),
        StartDate = sub.StartDate,
        EndDate = sub.EndDate,
        NextBillingDate = sub.NextBillingDate,
        PriceAtPurchase = sub.PriceAtPurchase,
    };
}

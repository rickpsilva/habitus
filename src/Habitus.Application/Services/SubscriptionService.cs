using Habitus.Application.DTOs.Subscriptions;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class SubscriptionService
{
    private static readonly Guid FreePlanId = new("a0b0c001-0000-0000-0000-000000000000");
    private static readonly Guid SilverPlanId = new("a0b0c002-0000-0000-0000-000000000000");
    private static readonly Guid GoldPlanId = new("a0b0c003-0000-0000-0000-000000000000");

    private static readonly IReadOnlyList<(string Key, string Label)> FeatureCatalog =
    [
        ("maintenance", "Manutenção"),
        ("announcements", "Comunicados"),
        ("documents", "Documentos"),
        ("reservations", "Reservas de Espaços"),
        ("financial", "Gestão Financeira"),
        ("assemblies", "Assembleias"),
        ("payments", "Pagamentos"),
        ("suppliers", "Fornecedores"),
        ("shared_spaces", "Espaços Comuns"),
        ("useful_contacts", "Contactos Úteis"),
        ("email_notifications", "Notificações por Email"),
        ("whatsapp_notifications", "Notificações WhatsApp"),
        ("payment_settings", "Configuração de Pagamentos"),
        ("communication_settings", "Configuração de Comunicação"),
        ("user_registration", "Registo e Gestão de Utilizadores"),
        ("analytics", "Analytics Avançado"),
        ("api_access", "Acesso à API REST"),
        ("multilanguage", "Multilíngua (PT/EN)"),
    ];

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

    public Task<List<FeatureCatalogItemDto>> GetFeatureCatalogAsync()
    {
        var features = FeatureCatalog
            .Select(f => new FeatureCatalogItemDto
            {
                FeatureKey = f.Key,
                FeatureLabel = f.Label,
            })
            .ToList();

        return Task.FromResult(features);
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

    public async Task<SubscriptionPlanDto> CreatePlanAsync(CreateSubscriptionPlanRequest request)
    {
        ValidatePricing(request.PriceMonthly, request.AnnualDiscountPercent, request.QuinquennialDiscountPercent);
        var tier = ParseTier(request.Tier);
        var (priceAnnual, priceQuinquennial) = CalculateDiscountedPrices(
            request.PriceMonthly,
            request.AnnualDiscountPercent,
            request.QuinquennialDiscountPercent);

        var plan = new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Tier = tier,
            Description = request.Description.Trim(),
            PriceMonthly = request.PriceMonthly,
            AnnualDiscountPercent = request.AnnualDiscountPercent,
            QuinquennialDiscountPercent = request.QuinquennialDiscountPercent,
            PriceAnnual = priceAnnual,
            PriceQuinquennial = priceQuinquennial,
            IsActive = request.IsActive,
        };

        await _plansRepo.AddAsync(plan);
        await _plansRepo.SaveChangesAsync();

        await UpsertPlanFeaturesAsync(plan.Id, request.Features);

        var created = await _plansRepo.GetByIdWithIncludesAsync(plan.Id, nameof(SubscriptionPlan.Features))
            ?? throw new InvalidOperationException("Created plan could not be loaded.");

        return MapPlanToDto(created);
    }

    public async Task<SubscriptionPlanDto> UpdatePlanAsync(Guid planId, UpdateSubscriptionPlanRequest request)
    {
        ValidatePricing(request.PriceMonthly, request.AnnualDiscountPercent, request.QuinquennialDiscountPercent);
        var tier = ParseTier(request.Tier);
        var (priceAnnual, priceQuinquennial) = CalculateDiscountedPrices(
            request.PriceMonthly,
            request.AnnualDiscountPercent,
            request.QuinquennialDiscountPercent);

        var plan = await _plansRepo.GetByIdAsync(planId)
            ?? throw new KeyNotFoundException($"Plan {planId} not found.");

        plan.Name = request.Name.Trim();
        plan.Tier = tier;
        plan.Description = request.Description.Trim();
        plan.PriceMonthly = request.PriceMonthly;
        plan.AnnualDiscountPercent = request.AnnualDiscountPercent;
        plan.QuinquennialDiscountPercent = request.QuinquennialDiscountPercent;
        plan.PriceAnnual = priceAnnual;
        plan.PriceQuinquennial = priceQuinquennial;
        plan.IsActive = request.IsActive;

        _plansRepo.Update(plan);
        await _plansRepo.SaveChangesAsync();

        await UpsertPlanFeaturesAsync(plan.Id, request.Features);

        var updated = await _plansRepo.GetByIdWithIncludesAsync(plan.Id, nameof(SubscriptionPlan.Features))
            ?? throw new InvalidOperationException("Updated plan could not be loaded.");

        return MapPlanToDto(updated);
    }

    public async Task<List<SubscriptionPlanDto>> ResetDefaultPlansAsync()
    {
        var defaults = GetDefaultPlans();

        foreach (var defaultPlan in defaults)
        {
            var existingPlan = await _plansRepo.GetByIdAsync(defaultPlan.Id);

            if (existingPlan is null)
            {
                await _plansRepo.AddAsync(new SubscriptionPlan
                {
                    Id = defaultPlan.Id,
                    Name = defaultPlan.Name,
                    Tier = defaultPlan.Tier,
                    Description = defaultPlan.Description,
                    PriceMonthly = defaultPlan.PriceMonthly,
                    AnnualDiscountPercent = defaultPlan.AnnualDiscountPercent,
                    QuinquennialDiscountPercent = defaultPlan.QuinquennialDiscountPercent,
                    PriceAnnual = defaultPlan.PriceAnnual,
                    PriceQuinquennial = defaultPlan.PriceQuinquennial,
                    IsActive = true,
                });
            }
            else
            {
                existingPlan.Name = defaultPlan.Name;
                existingPlan.Tier = defaultPlan.Tier;
                existingPlan.Description = defaultPlan.Description;
                existingPlan.PriceMonthly = defaultPlan.PriceMonthly;
                existingPlan.AnnualDiscountPercent = defaultPlan.AnnualDiscountPercent;
                existingPlan.QuinquennialDiscountPercent = defaultPlan.QuinquennialDiscountPercent;
                existingPlan.PriceAnnual = defaultPlan.PriceAnnual;
                existingPlan.PriceQuinquennial = defaultPlan.PriceQuinquennial;
                existingPlan.IsActive = true;
                _plansRepo.Update(existingPlan);
            }

            await _plansRepo.SaveChangesAsync();

            var existingFeatures = (await _featuresRepo.FindAsync(f => f.PlanId == defaultPlan.Id)).ToList();
            foreach (var feature in defaultPlan.Features)
            {
                var current = existingFeatures.FirstOrDefault(f =>
                    string.Equals(f.FeatureKey, feature.FeatureKey, StringComparison.OrdinalIgnoreCase));

                if (current is null)
                {
                    await _featuresRepo.AddAsync(new PlanFeature
                    {
                        Id = Guid.NewGuid(),
                        PlanId = defaultPlan.Id,
                        FeatureKey = feature.FeatureKey,
                        FeatureLabel = feature.FeatureLabel,
                        IsEnabled = feature.IsEnabled,
                    });
                    continue;
                }

                current.FeatureLabel = feature.FeatureLabel;
                current.IsEnabled = feature.IsEnabled;
                _featuresRepo.Update(current);
            }

            await _featuresRepo.SaveChangesAsync();
        }

        return await GetAllPlansAsync();
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
        AnnualDiscountPercent = plan.AnnualDiscountPercent,
        QuinquennialDiscountPercent = plan.QuinquennialDiscountPercent,
        PriceAnnual = plan.PriceAnnual,
        PriceQuinquennial = plan.PriceQuinquennial,
        IsActive = plan.IsActive,
        Features = plan.Features
            .OrderBy(f => f.FeatureLabel)
            .Select(f => new PlanFeatureDto
        {
            FeatureKey = f.FeatureKey,
            FeatureLabel = f.FeatureLabel,
            IsEnabled = f.IsEnabled,
        })
            .ToList(),
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

    private static PlanTier ParseTier(string tier)
    {
        if (!Enum.TryParse<PlanTier>(tier, true, out var parsedTier))
            throw new InvalidOperationException($"Invalid plan tier '{tier}'.");

        return parsedTier;
    }

    private static void ValidatePricing(decimal monthlyPrice, decimal annualDiscountPercent, decimal quinquennialDiscountPercent)
    {
        if (monthlyPrice < 0m)
            throw new InvalidOperationException("Monthly price must be greater or equal to zero.");

        if (annualDiscountPercent < 0m || annualDiscountPercent > 100m)
            throw new InvalidOperationException("Annual discount must be between 0 and 100.");

        if (quinquennialDiscountPercent < 0m || quinquennialDiscountPercent > 100m)
            throw new InvalidOperationException("5-year discount must be between 0 and 100.");
    }

    private static (decimal PriceAnnual, decimal PriceQuinquennial) CalculateDiscountedPrices(
        decimal monthlyPrice,
        decimal annualDiscountPercent,
        decimal quinquennialDiscountPercent)
    {
        if (monthlyPrice == 0m)
            return (0m, 0m);

        var annual = Math.Round(monthlyPrice * 12m * (1m - annualDiscountPercent / 100m), 2);
        var quinquennial = Math.Round(monthlyPrice * 60m * (1m - quinquennialDiscountPercent / 100m), 2);

        return (annual, quinquennial);
    }

    private async Task UpsertPlanFeaturesAsync(Guid planId, IEnumerable<PlanFeatureToggleRequest> requestedFeatures)
    {
        var requestedByKey = requestedFeatures
            .GroupBy(f => f.FeatureKey.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Last().IsEnabled, StringComparer.OrdinalIgnoreCase);

        var existing = (await _featuresRepo.FindAsync(f => f.PlanId == planId)).ToList();

        foreach (var (featureKey, featureLabel) in FeatureCatalog)
        {
            var isEnabled = requestedByKey.TryGetValue(featureKey, out var requestedState)
                ? requestedState
                : false;

            var current = existing.FirstOrDefault(f =>
                string.Equals(f.FeatureKey, featureKey, StringComparison.OrdinalIgnoreCase));

            if (current is null)
            {
                await _featuresRepo.AddAsync(new PlanFeature
                {
                    Id = Guid.NewGuid(),
                    PlanId = planId,
                    FeatureKey = featureKey,
                    FeatureLabel = featureLabel,
                    IsEnabled = isEnabled,
                });
                continue;
            }

            current.FeatureLabel = featureLabel;
            current.IsEnabled = isEnabled;
            _featuresRepo.Update(current);
        }

        await _featuresRepo.SaveChangesAsync();
    }

    private static IReadOnlyList<DefaultPlanSeed> GetDefaultPlans() =>
    [
        new DefaultPlanSeed(
            FreePlanId,
            "Free",
            PlanTier.Free,
            "Base operacional com features essenciais.",
            0m,
            0m,
            0m,
            0m,
            0m,
            [
                new DefaultFeatureSeed("maintenance", "Manutenção", true),
                new DefaultFeatureSeed("announcements", "Comunicados", true),
                new DefaultFeatureSeed("documents", "Documentos (até 10)", true),
            ]),
        new DefaultPlanSeed(
            SilverPlanId,
            "Silver",
            PlanTier.Silver,
            "Automações e módulos avançados para condomínios em crescimento.",
            29.90m,
            17m,
            30m,
            299.00m,
            1299.00m,
            [
                new DefaultFeatureSeed("maintenance", "Manutenção", true),
                new DefaultFeatureSeed("announcements", "Comunicados", true),
                new DefaultFeatureSeed("documents", "Documentos (ilimitados)", true),
                new DefaultFeatureSeed("reservations", "Reservas de Espaços", true),
                new DefaultFeatureSeed("financial", "Gestão Financeira", true),
                new DefaultFeatureSeed("assemblies", "Assembleias", true),
                new DefaultFeatureSeed("email_notifications", "Notificações por Email", true),
            ]),
        new DefaultPlanSeed(
            GoldPlanId,
            "Gold",
            PlanTier.Gold,
            "Controlo total: analytics, WhatsApp e acesso à API REST.",
            59.90m,
            17m,
            30m,
            599.00m,
            2499.00m,
            [
                new DefaultFeatureSeed("maintenance", "Manutenção", true),
                new DefaultFeatureSeed("announcements", "Comunicados", true),
                new DefaultFeatureSeed("documents", "Documentos (ilimitados)", true),
                new DefaultFeatureSeed("reservations", "Reservas de Espaços", true),
                new DefaultFeatureSeed("financial", "Gestão Financeira", true),
                new DefaultFeatureSeed("assemblies", "Assembleias", true),
                new DefaultFeatureSeed("email_notifications", "Notificações por Email", true),
                new DefaultFeatureSeed("analytics", "Analytics Avançado", true),
                new DefaultFeatureSeed("whatsapp_notifications", "Notificações WhatsApp", true),
                new DefaultFeatureSeed("api_access", "Acesso à API REST", true),
            ]),
    ];

    private sealed record DefaultPlanSeed(
        Guid Id,
        string Name,
        PlanTier Tier,
        string Description,
        decimal PriceMonthly,
        decimal AnnualDiscountPercent,
        decimal QuinquennialDiscountPercent,
        decimal PriceAnnual,
        decimal PriceQuinquennial,
        IReadOnlyList<DefaultFeatureSeed> Features);

    private sealed record DefaultFeatureSeed(string FeatureKey, string FeatureLabel, bool IsEnabled);
}

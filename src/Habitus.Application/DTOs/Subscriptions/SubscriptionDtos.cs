using Habitus.Domain.Entities;

namespace Habitus.Application.DTOs.Subscriptions;

public class PlanFeatureDto
{
    public string FeatureKey { get; set; } = string.Empty;
    public string FeatureLabel { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
}

public class FeatureCatalogItemDto
{
    public string FeatureKey { get; set; } = string.Empty;
    public string FeatureLabel { get; set; } = string.Empty;
}

public class SubscriptionPlanDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Tier { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal PriceMonthly { get; set; }
    public decimal AnnualDiscountPercent { get; set; }
    public decimal QuinquennialDiscountPercent { get; set; }
    public decimal PriceAnnual { get; set; }
    public decimal PriceQuinquennial { get; set; }
    public bool IsActive { get; set; }
    public List<PlanFeatureDto> Features { get; set; } = new();
}

public class PlanFeatureToggleRequest
{
    public string FeatureKey { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
}

public class CreateSubscriptionPlanRequest
{
    public string Name { get; set; } = string.Empty;
    public string Tier { get; set; } = PlanTier.Free.ToString();
    public string Description { get; set; } = string.Empty;
    public decimal PriceMonthly { get; set; }
    public decimal AnnualDiscountPercent { get; set; }
    public decimal QuinquennialDiscountPercent { get; set; }
    public bool IsActive { get; set; } = true;
    public List<PlanFeatureToggleRequest> Features { get; set; } = new();
}

public class UpdateSubscriptionPlanRequest
{
    public string Name { get; set; } = string.Empty;
    public string Tier { get; set; } = PlanTier.Free.ToString();
    public string Description { get; set; } = string.Empty;
    public decimal PriceMonthly { get; set; }
    public decimal AnnualDiscountPercent { get; set; }
    public decimal QuinquennialDiscountPercent { get; set; }
    public bool IsActive { get; set; }
    public List<PlanFeatureToggleRequest> Features { get; set; } = new();
}

public class CondominiumSubscriptionDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public string CondominiumName { get; set; } = string.Empty;
    public SubscriptionPlanDto Plan { get; set; } = null!;
    public string BillingCycle { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime NextBillingDate { get; set; }
    public decimal PriceAtPurchase { get; set; }
}

public class AssignSubscriptionRequest
{
    public Guid CondominiumId { get; set; }
    public Guid PlanId { get; set; }
    public string BillingCycle { get; set; } = "Monthly";
}

public class SubscriptionStatsDto
{
    public int TotalCondominiums { get; set; }
    public int ActiveSubscriptions { get; set; }
    public decimal MonthlyBillingVolume { get; set; }
}

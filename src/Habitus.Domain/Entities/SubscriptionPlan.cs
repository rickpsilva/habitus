namespace Habitus.Domain.Entities;

public enum PlanTier { Free = 0, Silver = 1, Gold = 2 }

public class SubscriptionPlan
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public PlanTier Tier { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal PriceMonthly { get; set; }
    public decimal AnnualDiscountPercent { get; set; }
    public decimal QuinquennialDiscountPercent { get; set; }
    public decimal PriceAnnual { get; set; }
    public decimal PriceQuinquennial { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<PlanFeature> Features { get; set; } = new List<PlanFeature>();
    public ICollection<CondominiumSubscription> Subscriptions { get; set; } = new List<CondominiumSubscription>();
}

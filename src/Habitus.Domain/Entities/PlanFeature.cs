namespace Habitus.Domain.Entities;

public class PlanFeature
{
    public Guid Id { get; set; }
    public Guid PlanId { get; set; }
    public string FeatureKey { get; set; } = string.Empty;
    public string FeatureLabel { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;

    public SubscriptionPlan Plan { get; set; } = null!;
}

namespace Habitus.Domain.Entities;

public enum BillingCycle { Monthly = 0, Annual = 1, Quinquennial = 2 }

public enum SubscriptionStatus { Active = 0, Cancelled = 1, PastDue = 2, Trialing = 3 }

public class CondominiumSubscription
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public Guid PlanId { get; set; }
    public BillingCycle BillingCycle { get; set; }
    public SubscriptionStatus Status { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime NextBillingDate { get; set; }
    public decimal PriceAtPurchase { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public Condominium Condominium { get; set; } = null!;
    public SubscriptionPlan Plan { get; set; } = null!;
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}

namespace Habitus.Domain.Entities;

public class PlatformBillingSettings
{
    public Guid Id { get; set; }
    public bool GatewayEnabled { get; set; }
    public string GatewayProvider { get; set; } = "stripe";
    public string? PublicKey { get; set; }
    public string? SecretKeyEncrypted { get; set; }
    public string? WebhookSecretEncrypted { get; set; }
    public string? MerchantDisplayName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

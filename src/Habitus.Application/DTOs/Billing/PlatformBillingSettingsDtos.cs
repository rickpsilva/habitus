namespace Habitus.Application.DTOs.Billing;

public class PlatformBillingSettingsDto
{
    public Guid Id { get; set; }
    public bool GatewayEnabled { get; set; }
    public string GatewayProvider { get; set; } = "stripe";
    public string? PublicKey { get; set; }
    public string? MerchantDisplayName { get; set; }
    public bool HasSecretKey { get; set; }
    public bool HasWebhookSecret { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdatePlatformBillingSettingsRequest
{
    public bool GatewayEnabled { get; set; }
    public string GatewayProvider { get; set; } = "stripe";
    public string? PublicKey { get; set; }
    public string? SecretKey { get; set; }
    public string? WebhookSecret { get; set; }
    public string? MerchantDisplayName { get; set; }
}

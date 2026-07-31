using Habitus.Application.DTOs.Billing;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Stripe;
using Stripe.Checkout;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Stripe payment gateway implementation.
/// Uses Stripe Checkout Sessions for hosted payment pages.
/// Webhook events are verified using HMAC-SHA256 (Stripe-Signature header).
/// </summary>
public class StripePaymentGatewayService : IPaymentGatewayService
{
    private readonly IPlatformSettingsCache _settingsCache;
    private readonly IEncryptionService _encryptionService;
    private readonly string? _fallbackSecretKey;
    private readonly string? _fallbackWebhookSecret;
    private readonly ILogger<StripePaymentGatewayService> _logger;

    // Metadata key used to attach the invoiceId to the Stripe session
    private const string InvoiceIdMetadataKey = "habitus_invoice_id";

    public StripePaymentGatewayService(
        IPlatformSettingsCache settingsCache,
        IEncryptionService encryptionService,
        IConfiguration configuration,
        ILogger<StripePaymentGatewayService> logger)
    {
        _settingsCache = settingsCache;
        _encryptionService = encryptionService;
        _logger = logger;
        _fallbackSecretKey = configuration["Stripe:SecretKey"];
        _fallbackWebhookSecret = configuration["Stripe:WebhookSecret"];
    }

    /// <inheritdoc/>
    public async Task<PaymentSessionDto> CreatePaymentSessionAsync(
        Guid invoiceId,
        decimal amount,
        string currency,
        string description,
        string successUrl,
        string cancelUrl,
        CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = await ResolveSecretKeyAsync();

        // Stripe amounts are in the smallest currency unit (cents for EUR)
        var amountInCents = (long)Math.Round(amount * 100, 0);

        var options = new SessionCreateOptions
        {
            PaymentMethodTypes = ["card"],
            LineItems =
            [
                new SessionLineItemOptions
                {
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = currency.ToLowerInvariant(),
                        UnitAmount = amountInCents,
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = description
                        }
                    },
                    Quantity = 1
                }
            ],
            Mode = "payment",
            SuccessUrl = $"{successUrl}?session_id={{CHECKOUT_SESSION_ID}}",
            CancelUrl = cancelUrl,
            Metadata = new Dictionary<string, string>
            {
                [InvoiceIdMetadataKey] = invoiceId.ToString()
            }
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options, cancellationToken: ct);

        _logger.LogInformation(
            "Stripe checkout session {SessionId} created for invoice {InvoiceId} — {Amount} {Currency}",
            session.Id, invoiceId, amount, currency);

        return new PaymentSessionDto
        {
            SessionId = session.Id,
            PaymentUrl = session.Url
        };
    }

    /// <inheritdoc/>
    public async Task<PaymentWebhookResult> HandleWebhookAsync(
        string payload,
        string signatureHeader,
        CancellationToken ct = default)
    {
        var webhookSecret = await ResolveWebhookSecretAsync();

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(payload, signatureHeader, webhookSecret);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning("Stripe webhook signature validation failed: {Message}", ex.Message);
            return new PaymentWebhookResult { IsPaymentSucceeded = false };
        }

        // We listen for checkout.session.completed which fires when payment is collected
        if (stripeEvent.Type != EventTypes.CheckoutSessionCompleted)
        {
            return new PaymentWebhookResult { IsPaymentSucceeded = false };
        }

        if (stripeEvent.Data.Object is not Session session)
        {
            _logger.LogWarning("Stripe checkout.session.completed event missing session object");
            return new PaymentWebhookResult { IsPaymentSucceeded = false };
        }

        if (session.PaymentStatus != "paid")
        {
            // e.g., "unpaid" or "no_payment_required"
            return new PaymentWebhookResult { IsPaymentSucceeded = false };
        }

        if (!session.Metadata.TryGetValue(InvoiceIdMetadataKey, out var invoiceIdStr)
            || !Guid.TryParse(invoiceIdStr, out var invoiceId))
        {
            _logger.LogWarning(
                "Stripe session {SessionId} has no valid {Key} metadata",
                session.Id, InvoiceIdMetadataKey);
            return new PaymentWebhookResult { IsPaymentSucceeded = false };
        }

        _logger.LogInformation(
            "Stripe checkout.session.completed for invoice {InvoiceId}, session {SessionId}",
            invoiceId, session.Id);

        return new PaymentWebhookResult
        {
            IsPaymentSucceeded = true,
            InvoiceId = invoiceId,
            GatewayReference = session.Id
        };
    }

    private async Task<string> ResolveSecretKeyAsync()
    {
        var settings = await _settingsCache.GetBillingAsync();
        if (!string.IsNullOrWhiteSpace(settings?.SecretKeyEncrypted))
        {
            return _encryptionService.Decrypt(settings.SecretKeyEncrypted);
        }

        if (!string.IsNullOrWhiteSpace(_fallbackSecretKey))
        {
            return _fallbackSecretKey;
        }

        throw new InvalidOperationException("Stripe:SecretKey is not configured");
    }

    private async Task<string> ResolveWebhookSecretAsync()
    {
        var settings = await _settingsCache.GetBillingAsync();
        if (!string.IsNullOrWhiteSpace(settings?.WebhookSecretEncrypted))
        {
            return _encryptionService.Decrypt(settings.WebhookSecretEncrypted);
        }

        if (!string.IsNullOrWhiteSpace(_fallbackWebhookSecret))
        {
            return _fallbackWebhookSecret;
        }

        throw new InvalidOperationException("Stripe:WebhookSecret is not configured");
    }
}

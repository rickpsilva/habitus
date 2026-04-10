using Habitus.Application.DTOs.Billing;
using Habitus.Application.Interfaces;
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
    private readonly string _webhookSecret;
    private readonly ILogger<StripePaymentGatewayService> _logger;

    // Metadata key used to attach the invoiceId to the Stripe session
    private const string InvoiceIdMetadataKey = "habitus_invoice_id";

    public StripePaymentGatewayService(
        IConfiguration configuration,
        ILogger<StripePaymentGatewayService> logger)
    {
        _logger = logger;

        var secretKey = configuration["Stripe:SecretKey"]
            ?? throw new InvalidOperationException("Stripe:SecretKey is not configured");

        _webhookSecret = configuration["Stripe:WebhookSecret"]
            ?? throw new InvalidOperationException("Stripe:WebhookSecret is not configured");

        StripeConfiguration.ApiKey = secretKey;
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
    public Task<PaymentWebhookResult> HandleWebhookAsync(
        string payload,
        string signatureHeader,
        CancellationToken ct = default)
    {
        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(payload, signatureHeader, _webhookSecret);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning("Stripe webhook signature validation failed: {Message}", ex.Message);
            return Task.FromResult(new PaymentWebhookResult { IsPaymentSucceeded = false });
        }

        // We listen for checkout.session.completed which fires when payment is collected
        if (stripeEvent.Type != EventTypes.CheckoutSessionCompleted)
        {
            return Task.FromResult(new PaymentWebhookResult { IsPaymentSucceeded = false });
        }

        if (stripeEvent.Data.Object is not Session session)
        {
            _logger.LogWarning("Stripe checkout.session.completed event missing session object");
            return Task.FromResult(new PaymentWebhookResult { IsPaymentSucceeded = false });
        }

        if (session.PaymentStatus != "paid")
        {
            // e.g., "unpaid" or "no_payment_required"
            return Task.FromResult(new PaymentWebhookResult { IsPaymentSucceeded = false });
        }

        if (!session.Metadata.TryGetValue(InvoiceIdMetadataKey, out var invoiceIdStr)
            || !Guid.TryParse(invoiceIdStr, out var invoiceId))
        {
            _logger.LogWarning(
                "Stripe session {SessionId} has no valid {Key} metadata",
                session.Id, InvoiceIdMetadataKey);
            return Task.FromResult(new PaymentWebhookResult { IsPaymentSucceeded = false });
        }

        _logger.LogInformation(
            "Stripe checkout.session.completed for invoice {InvoiceId}, session {SessionId}",
            invoiceId, session.Id);

        return Task.FromResult(new PaymentWebhookResult
        {
            IsPaymentSucceeded = true,
            InvoiceId = invoiceId,
            GatewayReference = session.Id
        });
    }
}

using Habitus.Application.DTOs.Billing;

namespace Habitus.Application.Interfaces;

/// <summary>
/// Abstraction over payment gateways (Stripe, Mock).
/// Implementations live in Infrastructure.
/// </summary>
public interface IPaymentGatewayService
{
    /// <summary>
    /// Create a payment session for the given invoice.
    /// Returns a URL the user should be redirected to in order to pay.
    /// </summary>
    Task<PaymentSessionDto> CreatePaymentSessionAsync(
        Guid invoiceId,
        decimal amount,
        string currency,
        string description,
        string successUrl,
        string cancelUrl,
        CancellationToken ct = default);

    /// <summary>
    /// Handle a raw webhook event from the payment gateway.
    /// Returns the invoiceId extracted from the event when a payment succeeds, or null otherwise.
    /// </summary>
    Task<PaymentWebhookResult> HandleWebhookAsync(
        string payload,
        string signatureHeader,
        CancellationToken ct = default);
}

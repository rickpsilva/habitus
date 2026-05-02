namespace Habitus.Application.DTOs.Billing;

/// <summary>
/// Returned when a payment session is created on the gateway.
/// </summary>
public class PaymentSessionDto
{
    /// <summary>Gateway-assigned session / checkout ID.</summary>
    public string SessionId { get; set; } = string.Empty;

    /// <summary>URL to redirect the user to complete payment.</summary>
    public string PaymentUrl { get; set; } = string.Empty;
}

/// <summary>
/// Result extracted from a gateway webhook event.
/// </summary>
public class PaymentWebhookResult
{
    /// <summary>Whether the event is a successful payment.</summary>
    public bool IsPaymentSucceeded { get; set; }

    /// <summary>Invoice ID attached to the session, populated on success.</summary>
    public Guid? InvoiceId { get; set; }

    /// <summary>Gateway's own session/payment ID for audit.</summary>
    public string? GatewayReference { get; set; }
}

/// <summary>
/// Response returned to the caller of POST /invoices/detail/{id}/initiate-payment.
/// </summary>
public class InitiateInvoicePaymentResponse
{
    public string PaymentUrl { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
}

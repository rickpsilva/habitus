using Habitus.Application.DTOs.Billing;
using Habitus.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Development-only payment gateway that always succeeds.
/// Logs the simulated operation; never hits a real payment provider.
/// </summary>
public class MockPaymentGatewayService : IPaymentGatewayService
{
    private readonly ILogger<MockPaymentGatewayService> _logger;

    public MockPaymentGatewayService(ILogger<MockPaymentGatewayService> logger)
    {
        _logger = logger;
    }

    public Task<PaymentSessionDto> CreatePaymentSessionAsync(
        Guid invoiceId,
        decimal amount,
        string currency,
        string description,
        string successUrl,
        string cancelUrl,
        CancellationToken ct = default)
    {
        var sessionId = $"mock_session_{invoiceId:N}";

        _logger.LogInformation(
            "[MockGateway] Created payment session {SessionId} for invoice {InvoiceId} — {Amount} {Currency}",
            sessionId, invoiceId, amount, currency);

        return Task.FromResult(new PaymentSessionDto
        {
            SessionId = sessionId,
            PaymentUrl = $"{successUrl}?session_id={sessionId}&mock=1"
        });
    }

    public Task<PaymentWebhookResult> HandleWebhookAsync(
        string payload,
        string signatureHeader,
        CancellationToken ct = default)
    {
        // Mock webhooks are not used in development; return no-op.
        _logger.LogWarning("[MockGateway] HandleWebhookAsync called — no-op in development");
        return Task.FromResult(new PaymentWebhookResult { IsPaymentSucceeded = false });
    }
}

using Habitus.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Mock implementation of IEmailService for development environments.
/// Logs emails instead of sending them via Azure.
/// </summary>
public class MockEmailService : IEmailService
{
    private readonly ILogger<MockEmailService> _logger;

    public MockEmailService(ILogger<MockEmailService> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(
        string to,
        string subject,
        string body,
        EmailSenderType senderType = EmailSenderType.System,
        Guid? condominiumId = null)
    {
        _logger.LogInformation("""
            ═══════════════════════════════════════════════════════
            📧 MOCK EMAIL SERVICE (Development Only)
            ═══════════════════════════════════════════════════════
            Sender:  {SenderType}
            CondoId: {CondominiumId}
            To:      {To}
            Subject: {Subject}
            ───────────────────────────────────────────────────────
            {Body}
            ═══════════════════════════════════════════════════════
            """, senderType, condominiumId, to, subject, body);
        
        return Task.CompletedTask;
    }
}

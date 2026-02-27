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

    public Task SendAsync(string to, string subject, string body)
    {
        _logger.LogInformation("""
            ═══════════════════════════════════════════════════════
            📧 MOCK EMAIL SERVICE (Development Only)
            ═══════════════════════════════════════════════════════
            To:      {To}
            Subject: {Subject}
            ───────────────────────────────────────────────────────
            {Body}
            ═══════════════════════════════════════════════════════
            """, to, subject, body);
        
        return Task.CompletedTask;
    }
}

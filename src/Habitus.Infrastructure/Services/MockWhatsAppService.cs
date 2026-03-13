using Habitus.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

public class MockWhatsAppService : IWhatsAppService
{
    private readonly ILogger<MockWhatsAppService> _logger;

    public MockWhatsAppService(ILogger<MockWhatsAppService> logger)
    {
        _logger = logger;
    }

    public Task SendGroupMessageAsync(string groupId, string message)
    {
        _logger.LogInformation("""
            =====================================================
            WhatsApp MOCK (Development)
            =====================================================
            Group: {GroupId}
            -----------------------------------------------------
            {Message}
            =====================================================
            """, groupId, message);

        return Task.CompletedTask;
    }
}

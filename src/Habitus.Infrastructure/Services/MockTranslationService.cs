using Habitus.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Mock implementation of ITranslationService for development environments.
/// Returns original text without actual translation.
/// </summary>
public class MockTranslationService : ITranslationService
{
    private readonly ILogger<MockTranslationService> _logger;

    public MockTranslationService(ILogger<MockTranslationService> logger)
    {
        _logger = logger;
    }

    public Task<string> TranslateAsync(string text, string targetLanguage)
    {
        _logger.LogInformation(
            "🌐 MOCK TRANSLATION SERVICE: Would translate to '{TargetLanguage}' - returning original text",
            targetLanguage
        );
        
        return Task.FromResult(text);
    }
}

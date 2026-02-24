using Azure;
using Azure.AI.Translation.Text;
using Habitus.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Habitus.Infrastructure.Services;

public class AzureTranslationService : ITranslationService
{
    private readonly TextTranslationClient _client;

    public AzureTranslationService(IConfiguration configuration)
    {
        var key = configuration["AzureTranslation:Key"]
            ?? throw new InvalidOperationException("AzureTranslation:Key is not configured.");
        var region = configuration["AzureTranslation:Region"]
            ?? throw new InvalidOperationException("AzureTranslation:Region is not configured.");
        _client = new TextTranslationClient(new AzureKeyCredential(key), region);
    }

    public async Task<string> TranslateAsync(string text, string targetLanguage)
    {
        var response = await _client.TranslateAsync(targetLanguage, text);
        return response.Value.FirstOrDefault()?.Translations?.FirstOrDefault()?.Text ?? text;
    }
}

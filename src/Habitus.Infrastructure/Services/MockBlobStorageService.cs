using Habitus.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Mock implementation of IBlobStorageService for development environments.
/// Simulates file uploads/deletions without actually storing to Azure.
/// </summary>
public class MockBlobStorageService : IBlobStorageService
{
    private readonly ILogger<MockBlobStorageService> _logger;
    private readonly Dictionary<string, string> _mockStorage = new();

    public MockBlobStorageService(ILogger<MockBlobStorageService> logger)
    {
        _logger = logger;
    }

    public Task<string> UploadAsync(Stream stream, string fileName, string contentType)
    {
        var mockUrl = $"https://mock-storage.local/habitus-docs/{fileName}";
        _mockStorage[fileName] = mockUrl;
        
        _logger.LogInformation(
            "📁 MOCK BLOB STORAGE: Uploaded file '{FileName}' ({ContentType})",
            fileName,
            contentType
        );
        
        return Task.FromResult(mockUrl);
    }

    public Task<(Stream Stream, string? ContentType)> DownloadAsync(string pathOrUrl)
    {
        var stream = new MemoryStream();
        return Task.FromResult<(Stream, string?)>((stream, "application/octet-stream"));
    }

    public Task DeleteAsync(string url)
    {
        var fileName = url.Split('/').Last();
        _mockStorage.Remove(fileName);
        
        _logger.LogInformation(
            "🗑️ MOCK BLOB STORAGE: Deleted file from URL '{Url}'",
            url
        );
        
        return Task.CompletedTask;
    }
}

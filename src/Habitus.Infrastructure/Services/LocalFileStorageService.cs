using Habitus.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Local file storage implementation for development environments.
/// Saves files to the local file system with organized folder structure.
/// </summary>
public class LocalFileStorageService : IBlobStorageService
{
    private readonly ILogger<LocalFileStorageService> _logger;
    private readonly string _uploadBasePath;

    public LocalFileStorageService(
        ILogger<LocalFileStorageService> logger,
        IConfiguration configuration)
    {
        _logger = logger;
        _uploadBasePath = configuration["FileStorage:LocalPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        
        // Ensure uploads directory exists
        if (!Directory.Exists(_uploadBasePath))
        {
            Directory.CreateDirectory(_uploadBasePath);
            _logger.LogInformation("Created uploads directory at: {Path}", _uploadBasePath);
        }
    }

    public async Task<string> UploadAsync(Stream stream, string fileName, string contentType)
    {
        // Generate unique filename to avoid conflicts
        var uniqueFileName = $"{Guid.NewGuid()}_{fileName}";
        var filePath = Path.Combine(_uploadBasePath, uniqueFileName);

        try
        {
            using var fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write);
            await stream.CopyToAsync(fileStream);
            
            _logger.LogInformation(
                "💾 LOCAL FILE STORAGE: Saved file '{FileName}' to '{FilePath}' ({ContentType})",
                fileName,
                filePath,
                contentType
            );

            // Return relative path for database storage
            return $"/uploads/{uniqueFileName}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving file '{FileName}' to local storage", fileName);
            throw;
        }
    }

    public Task DeleteAsync(string filePath)
    {
        try
        {
            // Convert relative path to absolute
            var relativePath = filePath.TrimStart('/');
            var absolutePath = Path.Combine(Directory.GetCurrentDirectory(), relativePath);

            if (File.Exists(absolutePath))
            {
                File.Delete(absolutePath);
                _logger.LogInformation(
                    "🗑️ LOCAL FILE STORAGE: Deleted file '{FilePath}'",
                    filePath
                );
            }
            else
            {
                _logger.LogWarning(
                    "⚠️ LOCAL FILE STORAGE: File not found for deletion: '{FilePath}'",
                    filePath
                );
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting file '{FilePath}' from local storage", filePath);
            throw;
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Gets the absolute file system path for a given relative path
    /// </summary>
    public string GetAbsolutePath(string relativePath)
    {
        var cleanPath = relativePath.TrimStart('/');
        return Path.Combine(Directory.GetCurrentDirectory(), cleanPath);
    }
}

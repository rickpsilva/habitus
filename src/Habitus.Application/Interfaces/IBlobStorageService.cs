namespace Habitus.Application.Interfaces;

public interface IBlobStorageService
{
    Task<string> UploadAsync(Stream stream, string fileName, string contentType);
    Task<(Stream Stream, string? ContentType)> DownloadAsync(string pathOrUrl);
    Task DeleteAsync(string url);
}

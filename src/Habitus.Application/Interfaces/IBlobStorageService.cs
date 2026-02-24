namespace Habitus.Application.Interfaces;

public interface IBlobStorageService
{
    Task<string> UploadAsync(Stream stream, string fileName, string contentType);
    Task DeleteAsync(string url);
}

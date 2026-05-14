using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Habitus.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Habitus.Infrastructure.Services;

public class AzureBlobStorageService : IBlobStorageService
{
    private readonly BlobServiceClient _client;
    private readonly string _containerName;

    public AzureBlobStorageService(IConfiguration configuration)
    {
        _client = new BlobServiceClient(configuration["AzureStorage:ConnectionString"]);
        _containerName = configuration["AzureStorage:ContainerName"] ?? "habitus-docs";
    }

    public async Task<string> UploadAsync(Stream stream, string fileName, string contentType)
    {
        var container = _client.GetBlobContainerClient(_containerName);
        await container.CreateIfNotExistsAsync(PublicAccessType.None);
        var blob = container.GetBlobClient(fileName);
        await blob.UploadAsync(stream, new BlobHttpHeaders { ContentType = contentType });
        return blob.Uri.ToString();
    }

    public async Task<(Stream Stream, string? ContentType)> DownloadAsync(string pathOrUrl)
    {
        var container = _client.GetBlobContainerClient(_containerName);
        var blobName = GetBlobName(pathOrUrl);
        var blob = container.GetBlobClient(blobName);

        var exists = await blob.ExistsAsync();
        if (!exists.Value)
        {
            throw new FileNotFoundException("Blob not found", blobName);
        }

        var download = await blob.DownloadStreamingAsync();
        return (download.Value.Content, download.Value.Details.ContentType);
    }

    public async Task DeleteAsync(string url)
    {
        var uri = new Uri(url);
        var fileName = uri.Segments.Last();
        var container = _client.GetBlobContainerClient(_containerName);
        await container.GetBlobClient(fileName).DeleteIfExistsAsync();
    }

    private string GetBlobName(string pathOrUrl)
    {
        if (Uri.TryCreate(pathOrUrl, UriKind.Absolute, out var uri))
        {
            var segments = uri.AbsolutePath.Trim('/').Split('/');
            if (segments.Length < 2)
            {
                throw new InvalidOperationException("Invalid blob URL format.");
            }

            return string.Join('/', segments.Skip(1));
        }

        return pathOrUrl.TrimStart('/');
    }
}

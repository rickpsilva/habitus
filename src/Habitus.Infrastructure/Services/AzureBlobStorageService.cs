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
        await container.CreateIfNotExistsAsync(PublicAccessType.Blob);
        var blob = container.GetBlobClient(fileName);
        await blob.UploadAsync(stream, new BlobHttpHeaders { ContentType = contentType });
        return blob.Uri.ToString();
    }

    public async Task DeleteAsync(string url)
    {
        var uri = new Uri(url);
        var fileName = uri.Segments.Last();
        var container = _client.GetBlobContainerClient(_containerName);
        await container.GetBlobClient(fileName).DeleteIfExistsAsync();
    }
}

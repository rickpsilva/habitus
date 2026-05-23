namespace Habitus.Domain.Entities;

public class PlatformUploadSettings
{
    public Guid Id { get; set; }
    public int MaxUploadSizeBytes { get; set; } = 600 * 1024;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
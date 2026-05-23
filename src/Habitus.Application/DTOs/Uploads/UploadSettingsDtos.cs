namespace Habitus.Application.DTOs.Uploads;

public class PlatformUploadSettingsDto
{
    public Guid Id { get; set; }
    public int MaxUploadSizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdatePlatformUploadSettingsRequest
{
    public int MaxUploadSizeBytes { get; set; }
}
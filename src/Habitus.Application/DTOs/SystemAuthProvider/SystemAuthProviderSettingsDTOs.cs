namespace Habitus.Application.DTOs.SystemAuthProvider;

public class SystemAuthProviderSettingsDto
{
    public Guid Id { get; set; }
    public bool GoogleEnabled { get; set; }
    public bool MicrosoftEnabled { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdateSystemAuthProviderSettingsRequest
{
    public bool GoogleEnabled { get; set; }
    public bool MicrosoftEnabled { get; set; }
}
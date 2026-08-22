namespace Habitus.Domain.Entities;

public class SystemAuthProviderSettings
{
    public Guid Id { get; set; }
    public bool GoogleEnabled { get; set; } = true;
    public bool MicrosoftEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
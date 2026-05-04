namespace Habitus.Domain.Entities;

public enum ExternalAuthProvider
{
    Google = 0,
    Microsoft = 1,
}

public class UserAuthProvider
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ExternalAuthProvider ProviderType { get; set; }
    public string ProviderUserId { get; set; } = string.Empty;
    public string ProviderEmail { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastUsedAt { get; set; }

    public User User { get; set; } = null!;
}
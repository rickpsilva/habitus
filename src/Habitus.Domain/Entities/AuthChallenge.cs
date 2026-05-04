namespace Habitus.Domain.Entities;

public enum AuthChallengePurpose
{
    TwoFactorLogin = 0,
}

public class AuthChallenge
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AuthChallengePurpose Purpose { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UsedAt { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    public User User { get; set; } = null!;
}
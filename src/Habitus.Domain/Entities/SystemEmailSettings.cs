namespace Habitus.Domain.Entities;

public class SystemEmailSettings
{
    public Guid Id { get; set; }
    public bool EmailEnabled { get; set; } = false;
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public string? Username { get; set; }
    public string? PasswordEncrypted { get; set; }
    public string FromAddress { get; set; } = "no-reply@habituscond.pt";
    public string FromName { get; set; } = "Habitus";
    public bool UseSsl { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

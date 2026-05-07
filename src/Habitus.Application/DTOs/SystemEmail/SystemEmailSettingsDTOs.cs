namespace Habitus.Application.DTOs.SystemEmail;

public class SystemEmailSettingsDto
{
    public Guid Id { get; set; }
    public bool EmailEnabled { get; set; }
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; }
    public string? Username { get; set; }
    public bool HasPassword { get; set; }
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
    public bool UseSsl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdateSystemEmailSettingsRequest
{
    public bool EmailEnabled { get; set; }
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string FromAddress { get; set; } = "no-reply@habituscond.pt";
    public string FromName { get; set; } = "Habitus";
    public bool UseSsl { get; set; } = true;
}

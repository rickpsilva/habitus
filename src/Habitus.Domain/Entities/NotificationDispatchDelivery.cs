namespace Habitus.Domain.Entities;

public class NotificationDispatchDelivery
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public string Channel { get; set; } = string.Empty; // email | whatsapp
    public string DispatchKey { get; set; } = string.Empty;
    public string Recipient { get; set; } = string.Empty; // email or group id
    public string Status { get; set; } = "Pending"; // Pending | Sent | Failed
    public int Attempts { get; set; }
    public DateTime? LastAttemptAt { get; set; }
    public DateTime? SentAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

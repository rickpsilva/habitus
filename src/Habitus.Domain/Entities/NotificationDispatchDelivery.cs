namespace Habitus.Domain.Entities;

public class NotificationDispatchDelivery
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public string Channel { get; set; } = string.Empty; // email | whatsapp
    public string DispatchKey { get; set; } = string.Empty;
    
    // For email channel: references the User that should receive the notification
    public Guid? RecipientUserId { get; set; }
    public User? RecipientUser { get; set; }
    
    // For external channels (e.g., WhatsApp group ID, third-party service identifiers)
    public string? RecipientExternalId { get; set; }
    
    public string Status { get; set; } = "Pending"; // Pending | Sent | Failed
    public int Attempts { get; set; }
    public DateTime? LastAttemptAt { get; set; }
    public DateTime? SentAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

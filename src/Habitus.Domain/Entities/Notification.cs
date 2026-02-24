namespace Habitus.Domain.Entities;

public enum NotificationType { Alert, Info, Urgent }

public class Notification
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public string TargetRole { get; set; } = string.Empty;
    public Guid BuildingId { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }
    public Building Building { get; set; } = null!;
}

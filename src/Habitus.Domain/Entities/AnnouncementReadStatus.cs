namespace Habitus.Domain.Entities;

public class AnnouncementReadStatus
{
    public Guid Id { get; set; }
    public Guid AnnouncementId { get; set; }
    public Announcement Announcement { get; set; } = null!;
    
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    
    public DateTime ReadAt { get; set; } = DateTime.UtcNow;
}

namespace Habitus.Domain.Entities;

public class AnnouncementComment
{
    public Guid Id { get; set; }
    public Guid AnnouncementId { get; set; }
    public Announcement Announcement { get; set; } = null!;
    
    public Guid AuthorId { get; set; }
    public User Author { get; set; } = null!;
    
    public Guid? UnitId { get; set; } // Fração do autor do comentário
    public Unit? Unit { get; set; }
    
    public string Content { get; set; } = string.Empty;
    public bool IsAnonymous { get; set; } // Comentário anónimo (só mostra fração)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

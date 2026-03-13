namespace Habitus.Domain.Entities;

public enum AttachmentType
{
    Image,      // .jpg, .jpeg, .png, .gif
    Document    // .pdf, .doc, .docx, .txt
}

public class AnnouncementAttachment
{
    public Guid Id { get; set; }
    public Guid AnnouncementId { get; set; }
    public Announcement Announcement { get; set; } = null!;
    
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty; // Caminho no servidor
    public AttachmentType Type { get; set; }
    public long FileSize { get; set; } // Em bytes
    public string? ContentType { get; set; } // MIME type
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

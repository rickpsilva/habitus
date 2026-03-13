namespace Habitus.Application.DTOs.Announcements;

public class AnnouncementDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool IsAnonymous { get; set; }
    public bool IsPinned { get; set; }
    public DateTime? ValidUntil { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    // Author info
    public Guid AuthorId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public Guid CondominiumId { get; set; }
    public Guid? UnitId { get; set; }
    public string? UnitNumber { get; set; }
    
    // Approval info
    public Guid? ApprovedByUserId { get; set; }
    public string? ApprovedByUserName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectionReason { get; set; }
    
    // Statistics
    public int TotalReads { get; set; }
    public int TotalComments { get; set; }
    public int TotalAttachments { get; set; }
    public bool IsReadByCurrentUser { get; set; }
    
    // Relations
    public List<AnnouncementAttachmentDto> Attachments { get; set; } = new();
    public List<AnnouncementCommentDto> Comments { get; set; } = new();
}

public class AnnouncementAttachmentDto
{
    public Guid Id { get; set; }
    public Guid AnnouncementId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? ContentType { get; set; }
    public DateTime UploadedAt { get; set; }
}

public class AnnouncementCommentDto
{
    public Guid Id { get; set; }
    public Guid AnnouncementId { get; set; }
    public Guid AuthorId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public Guid? UnitId { get; set; }
    public string? UnitNumber { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsAnonymous { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class AnnouncementReadStatusDto
{
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public Guid? UnitId { get; set; }
    public string? UnitNumber { get; set; }
    public DateTime ReadAt { get; set; }
}

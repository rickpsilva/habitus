namespace Habitus.Application.DTOs.Announcements;

public class CreateAnnouncementRequest
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty; // HTML content
    public string Category { get; set; } = string.Empty; // Works, Noise, Mail, General, Urgent, Event
    public bool IsAnonymous { get; set; } = false;
    public DateTime? ValidUntil { get; set; }
    public bool PublishImmediately { get; set; } = false; // Se false, fica em Draft
}

public class UpdateAnnouncementRequest
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsAnonymous { get; set; }
    public DateTime? ValidUntil { get; set; }
}

public class ApproveAnnouncementRequest
{
    public bool IsApproved { get; set; }
    public string? RejectionReason { get; set; }
}

public class CreateAnnouncementCommentRequest
{
    public string Content { get; set; } = string.Empty;
    public bool IsAnonymous { get; set; } = false;
}

public class UpdateAnnouncementCommentRequest
{
    public string Content { get; set; } = string.Empty;
}

public class AnnouncementStatsDto
{
    public int TotalAnnouncements { get; set; }
    public int PendingApproval { get; set; }
    public int Published { get; set; }
    public int MyDrafts { get; set; }
    public int Unread { get; set; }
}

public class AnnouncementSettingsDto
{
    public bool AllowAnnouncementComments { get; set; } = true;
}

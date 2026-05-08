using Habitus.Application.DTOs.Announcements;
using Habitus.Application.Interfaces;
using Habitus.Api.Middleware;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/condominiums/{condominiumId}/[controller]")]
[RequireFeature("announcements")]
public class AnnouncementsController : ControllerBase
{
    private readonly HabitusDbContext _context;
    private readonly IWebHostEnvironment _env;
    private readonly INotificationDispatchService _notificationDispatchService;

    public AnnouncementsController(HabitusDbContext context, IWebHostEnvironment env, INotificationDispatchService notificationDispatchService)
    {
        _context = context;
        _env = env;
        _notificationDispatchService = notificationDispatchService;
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET: api/condominiums/{condominiumId}/announcements
    [HttpGet]
    public async Task<ActionResult<List<AnnouncementDto>>> GetAll(Guid condominiumId, [FromQuery] string? status = null)
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Unauthorized();

        var isAdmin = user.Role == UserRole.Admin;

        var query = _context.Announcements
            .Include(a => a.Author)
            .Include(a => a.Unit)
            .Include(a => a.ApprovedByUser)
            .Include(a => a.Attachments)
            .Include(a => a.Comments)
            .Include(a => a.ReadStatuses)
            .Where(a => a.CondominiumId == condominiumId);

        // Visibility rules (always applied, even when status filter is used):
        // - Resident: published announcements + own announcements
        // - Admin: all except drafts from other users
        if (isAdmin)
        {
            query = query.Where(a => a.Status != AnnouncementStatus.Draft || a.AuthorId == userId);
        }
        else
        {
            query = query.Where(a => a.Status == AnnouncementStatus.Published || a.AuthorId == userId);
        }

        // Filter by status
        if (!string.IsNullOrEmpty(status))
        {
            if (Enum.TryParse<AnnouncementStatus>(status, out var statusEnum))
            {
                query = query.Where(a => a.Status == statusEnum);
            }
        }

        var announcements = await query
            .OrderByDescending(a => a.IsPinned)
            .ThenByDescending(a => a.PublishedAt ?? a.CreatedAt)
            .ToListAsync();

        var dtos = announcements.Select(a => MapToDto(a, userId)).ToList();
        return Ok(dtos);
    }

    // GET: api/condominiums/{condominiumId}/announcements/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<AnnouncementDto>> GetById(Guid condominiumId, Guid id)
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Unauthorized();
        var isAdmin = user.Role == UserRole.Admin;
        
        var announcement = await _context.Announcements
            .Include(a => a.Author)
            .Include(a => a.Unit)
            .Include(a => a.ApprovedByUser)
            .Include(a => a.Attachments)
            .Include(a => a.Comments).ThenInclude(c => c.Author)
            .Include(a => a.Comments).ThenInclude(c => c.Unit)
            .Include(a => a.ReadStatuses)
            .FirstOrDefaultAsync(a => a.Id == id && a.CondominiumId == condominiumId);

        if (announcement == null) return NotFound();

        // Drafts are private to author only.
        if (announcement.Status == AnnouncementStatus.Draft && announcement.AuthorId != userId)
            return Forbid();

        // Unpublished announcements are not visible to other residents.
        if (announcement.Status != AnnouncementStatus.Published && announcement.AuthorId != userId && !isAdmin)
            return Forbid();

        // Mark as read if published
        if (announcement.Status == AnnouncementStatus.Published)
        {
            var existingRead = await _context.AnnouncementReadStatuses
                .FirstOrDefaultAsync(r => r.AnnouncementId == id && r.UserId == userId);

            if (existingRead == null)
            {
                _context.AnnouncementReadStatuses.Add(new AnnouncementReadStatus
                {
                    Id = Guid.NewGuid(),
                    AnnouncementId = id,
                    UserId = userId,
                    ReadAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }
        }

        return Ok(MapToDto(announcement, userId));
    }

    // GET: api/condominiums/{condominiumId}/announcements/stats
    [HttpGet("stats")]
    public async Task<ActionResult<AnnouncementStatsDto>> GetStats(Guid condominiumId)
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Unauthorized();

        var isAdmin = user.Role == UserRole.Admin;

        var baseQuery = _context.Announcements.Where(a => a.CondominiumId == condominiumId);

        // Keep stats aligned with visibility rules used by the list endpoint.
        var visibleQuery = isAdmin
            ? baseQuery.Where(a => a.Status != AnnouncementStatus.Draft || a.AuthorId == userId)
            : baseQuery.Where(a => a.Status == AnnouncementStatus.Published || a.AuthorId == userId);

        var publishedVisibleQuery = visibleQuery.Where(a => a.Status == AnnouncementStatus.Published);

        var stats = new AnnouncementStatsDto
        {
            TotalAnnouncements = await visibleQuery.CountAsync(),
            PendingApproval = isAdmin ? await visibleQuery.CountAsync(a => a.Status == AnnouncementStatus.PendingApproval) : 0,
            Published = await publishedVisibleQuery.CountAsync(),
            MyDrafts = await baseQuery.CountAsync(a => a.AuthorId == userId && a.Status == AnnouncementStatus.Draft),
            Unread = await publishedVisibleQuery.CountAsync(a => !a.ReadStatuses.Any(r => r.UserId == userId))
        };

        return Ok(stats);
    }

    // GET: api/condominiums/{condominiumId}/announcements/settings
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(Guid condominiumId)
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null || user.CondominiumId != condominiumId)
            return Forbid();

        var settings = await _context.CommunicationSettings
            .FirstOrDefaultAsync(s => s.CondominiumId == condominiumId);

        return Ok(new
        {
            allowAnnouncementComments = settings?.AllowAnnouncementComments ?? true
        });
    }

    // POST: api/condominiums/{condominiumId}/announcements
    [HttpPost]
    public async Task<ActionResult<AnnouncementDto>> Create(Guid condominiumId, [FromBody] CreateAnnouncementRequest request)
    {
        var userId = GetUserId();
        var user = await _context.Users.Include(u => u.Unit).FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized();

        if (!Enum.TryParse<AnnouncementCategory>(request.Category, out var category))
            return BadRequest("Invalid category");

        var status = request.PublishImmediately 
            ? AnnouncementStatus.PendingApproval 
            : AnnouncementStatus.Draft;

        var announcement = new Announcement
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Content = request.Content,
            Category = category,
            Status = status,
            IsAnonymous = request.IsAnonymous,
            ValidUntil = request.ValidUntil,
            AuthorId = userId,
            CondominiumId = condominiumId,
            UnitId = user.UnitId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Announcements.Add(announcement);
        await _context.SaveChangesAsync();

        if (status == AnnouncementStatus.PendingApproval)
        {
            await NotifyAdminsPendingApprovalAsync(condominiumId, announcement);
        }

        return CreatedAtAction(nameof(GetById), new { condominiumId, id = announcement.Id }, MapToDto(announcement, userId));
    }

    // PUT: api/condominiums/{condominiumId}/announcements/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<AnnouncementDto>> Update(Guid condominiumId, Guid id, [FromBody] UpdateAnnouncementRequest request)
    {
        var userId = GetUserId();
        var announcement = await _context.Announcements.FindAsync(id);

        if (announcement == null || announcement.CondominiumId != condominiumId)
            return NotFound();

        if (announcement.AuthorId != userId)
            return Forbid();

        if (announcement.Status != AnnouncementStatus.Draft)
            return BadRequest("Only draft announcements can be edited");

        if (!Enum.TryParse<AnnouncementCategory>(request.Category, out var category))
            return BadRequest("Invalid category");

        announcement.Title = request.Title;
        announcement.Content = request.Content;
        announcement.Category = category;
        announcement.IsAnonymous = request.IsAnonymous;
        announcement.ValidUntil = request.ValidUntil;
        announcement.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(MapToDto(announcement, userId));
    }

    // POST: api/condominiums/{condominiumId}/announcements/{id}/publish
    [HttpPost("{id}/publish")]
    public async Task<IActionResult> Publish(Guid condominiumId, Guid id)
    {
        var userId = GetUserId();
        var announcement = await _context.Announcements.FindAsync(id);

        if (announcement == null || announcement.CondominiumId != condominiumId)
            return NotFound();

        if (announcement.AuthorId != userId)
            return Forbid();

        if (announcement.Status != AnnouncementStatus.Draft)
            return BadRequest("Only draft announcements can be published");

        announcement.Status = AnnouncementStatus.PendingApproval;
        announcement.UpdatedAt = DateTime.UtcNow;

        await NotifyAdminsPendingApprovalAsync(condominiumId, announcement);

        return Ok(new { message = "Comunicado submetido para aprovação." });
    }

    // POST: api/condominiums/{condominiumId}/announcements/{id}/approve
    [HttpPost("{id}/approve")]
    public async Task<IActionResult> Approve(Guid condominiumId, Guid id, [FromBody] ApproveAnnouncementRequest request)
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        
        if (user == null || user.Role != UserRole.Admin)
            return Forbid();

        var announcement = await _context.Announcements
            .Include(a => a.Author)
            .Include(a => a.Attachments)
            .FirstOrDefaultAsync(a => a.Id == id && a.CondominiumId == condominiumId);

        if (announcement == null) return NotFound();

        if (announcement.Status != AnnouncementStatus.PendingApproval)
            return BadRequest("Apenas comunicados pendentes podem ser aprovados/rejeitados.");

        if (request.IsApproved)
        {
            announcement.Status = AnnouncementStatus.Published;
            announcement.ApprovedByUserId = userId;
            announcement.ApprovedAt = DateTime.UtcNow;
            announcement.PublishedAt = DateTime.UtcNow;

            // Create notifications for all users in condominium
            var condoUsers = await _context.Users
                .Where(u => u.CondominiumId == condominiumId && u.Id != announcement.AuthorId && u.IsActive)
                .ToListAsync();

            var notifications = new List<Notification>();
            foreach (var condoUser in condoUsers)
            {
                var openUrl = $"/announcements?open={announcement.Id}";

                var notification = new Notification
                {
                    Id = Guid.NewGuid(),
                    Title = "Novo Comunicado",
                    Message = $"📢 {announcement.Title}\nVer: {openUrl}",
                    Type = announcement.Category == AnnouncementCategory.Urgent ? NotificationType.Urgent : NotificationType.Info,
                    TargetRole = condoUser.Role.ToString(),
                    TargetUserId = condoUser.Id,
                    CondominiumId = condominiumId,
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                };
                _context.Notifications.Add(notification);
                notifications.Add(notification);
            }

            await _context.SaveChangesAsync();
            await _notificationDispatchService.DispatchAsync(notifications, sendExternalChannels: false);
            return Ok(new { message = request.IsApproved ? "Comunicado publicado." : "Comunicado rejeitado." });
        }
        else
        {
            announcement.Status = AnnouncementStatus.Rejected;
            announcement.RejectionReason = request.RejectionReason;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = request.IsApproved ? "Comunicado publicado." : "Comunicado rejeitado." });
    }

    // POST: api/condominiums/{condominiumId}/announcements/{id}/pin
    [HttpPost("{id}/pin")]
    public async Task<IActionResult> TogglePin(Guid condominiumId, Guid id)
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        
        if (user == null || user.Role != UserRole.Admin)
            return Forbid();

        var announcement = await _context.Announcements.FindAsync(id);

        if (announcement == null || announcement.CondominiumId != condominiumId)
            return NotFound();

        announcement.IsPinned = !announcement.IsPinned;
        await _context.SaveChangesAsync();

        return Ok(new { isPinned = announcement.IsPinned });
    }

    // DELETE: api/condominiums/{condominiumId}/announcements/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid condominiumId, Guid id)
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        var announcement = await _context.Announcements.FindAsync(id);

        if (announcement == null || announcement.CondominiumId != condominiumId)
            return NotFound();

        // Only author or admin can delete
        if (announcement.AuthorId != userId && user?.Role != UserRole.Admin)
            return Forbid();

        // Delete attachments from filesystem
        var attachments = await _context.AnnouncementAttachments
            .Where(a => a.AnnouncementId == id)
            .ToListAsync();

        foreach (var attachment in attachments)
        {
            var filePath = Path.Combine(_env.ContentRootPath, attachment.FilePath);
            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
            }
        }

        _context.Announcements.Remove(announcement);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/condominiums/{condominiumId}/announcements/{id}/comments
    [HttpPost("{id}/comments")]
    public async Task<ActionResult<AnnouncementCommentDto>> AddComment(Guid condominiumId, Guid id, [FromBody] CreateAnnouncementCommentRequest request)
    {
        var userId = GetUserId();
        var user = await _context.Users.Include(u => u.Unit).FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized();

        // Check if comments are allowed
        var settings = await _context.CommunicationSettings.FirstOrDefaultAsync(s => s.CondominiumId == condominiumId);
        if (settings?.AllowAnnouncementComments == false)
            return BadRequest("Comments are disabled for this condominium");

        var announcement = await _context.Announcements
            .Include(a => a.Author)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (announcement == null || announcement.CondominiumId != condominiumId)
            return NotFound();

        if (announcement.Status != AnnouncementStatus.Published)
            return BadRequest("Cannot comment on unpublished announcements");

        var comment = new AnnouncementComment
        {
            Id = Guid.NewGuid(),
            AnnouncementId = id,
            AuthorId = userId,
            UnitId = user.UnitId,
            Content = request.Content,
            IsAnonymous = request.IsAnonymous,
            CreatedAt = DateTime.UtcNow
        };

        _context.AnnouncementComments.Add(comment);
        await _context.SaveChangesAsync();

        // Notify announcement author
        if (announcement.AuthorId != userId)
        {
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                Title = "Novo Comentário",
                Message = $"💬 Novo comentário no seu comunicado: {announcement.Title}",
                Type = NotificationType.Info,
                TargetRole = announcement.Author.Role.ToString(),
                TargetUserId = announcement.AuthorId,
                CondominiumId = condominiumId,
                SentAt = DateTime.UtcNow,
                IsRead = false
            };
            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();
            await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: true);
        }

        return Ok(MapCommentToDto(comment, user));
    }

    // DELETE: api/condominiums/{condominiumId}/announcements/{announcementId}/comments/{commentId}
    [HttpDelete("{announcementId}/comments/{commentId}")]
    public async Task<IActionResult> DeleteComment(Guid condominiumId, Guid announcementId, Guid commentId)
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        var comment = await _context.AnnouncementComments.FindAsync(commentId);

        if (comment == null || comment.AnnouncementId != announcementId)
            return NotFound();

        // Only author or admin can delete
        if (comment.AuthorId != userId && user?.Role != UserRole.Admin)
            return Forbid();

        _context.AnnouncementComments.Remove(comment);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/condominiums/{condominiumId}/announcements/{id}/attachments
    [HttpPost("{id}/attachments")]
    public async Task<ActionResult<AnnouncementAttachmentDto>> UploadAttachment(Guid condominiumId, Guid id, IFormFile file)
    {
        var userId = GetUserId();
        var announcement = await _context.Announcements
            .Include(a => a.Attachments)
            .FirstOrDefaultAsync(a => a.Id == id && a.CondominiumId == condominiumId);

        if (announcement == null) return NotFound();
        if (announcement.AuthorId != userId) return Forbid();
        if (announcement.Status != AnnouncementStatus.Draft) 
            return BadRequest("Can only upload attachments to draft announcements");

        // Validate file
        var allowedImageTypes = new[] { ".jpg", ".jpeg", ".png", ".gif" };
        var allowedDocTypes = new[] { ".pdf", ".doc", ".docx", ".txt" };
        var ext = Path.GetExtension(file.FileName).ToLower();
        
        AttachmentType attachmentType;
        if (allowedImageTypes.Contains(ext))
        {
            attachmentType = AttachmentType.Image;
            var imageCount = announcement.Attachments.Count(a => a.Type == AttachmentType.Image);
            if (imageCount >= 5) return BadRequest("Maximum 5 images allowed");
        }
        else if (allowedDocTypes.Contains(ext))
        {
            attachmentType = AttachmentType.Document;
            var docCount = announcement.Attachments.Count(a => a.Type == AttachmentType.Document);
            if (docCount >= 2) return BadRequest("Maximum 2 documents allowed");
        }
        else
        {
            return BadRequest("Invalid file type");
        }

        // Max 10MB
        if (file.Length > 10 * 1024 * 1024)
            return BadRequest("File too large (max 10MB)");

        // Save file
        var uploadsFolder = Path.Combine(_env.ContentRootPath, "announcements");
        Directory.CreateDirectory(uploadsFolder);
        
        var uniqueFileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var attachment = new AnnouncementAttachment
        {
            Id = Guid.NewGuid(),
            AnnouncementId = id,
            FileName = file.FileName,
            FilePath = $"announcements/{uniqueFileName}",
            Type = attachmentType,
            FileSize = file.Length,
            ContentType = file.ContentType,
            UploadedAt = DateTime.UtcNow
        };

        _context.AnnouncementAttachments.Add(attachment);
        await _context.SaveChangesAsync();

        return Ok(MapAttachmentToDto(attachment));
    }

    // DELETE: api/condominiums/{condominiumId}/announcements/{announcementId}/attachments/{attachmentId}
    [HttpDelete("{announcementId}/attachments/{attachmentId}")]
    public async Task<IActionResult> DeleteAttachment(Guid condominiumId, Guid announcementId, Guid attachmentId)
    {
        var userId = GetUserId();
        var announcement = await _context.Announcements.FindAsync(announcementId);
        if (announcement == null || announcement.CondominiumId != condominiumId) return NotFound();
        if (announcement.AuthorId != userId) return Forbid();

        var attachment = await _context.AnnouncementAttachments.FindAsync(attachmentId);
        if (attachment == null || attachment.AnnouncementId != announcementId) return NotFound();

        // Delete file
        var filePath = Path.Combine(_env.ContentRootPath, attachment.FilePath);
        if (System.IO.File.Exists(filePath))
        {
            System.IO.File.Delete(filePath);
        }

        _context.AnnouncementAttachments.Remove(attachment);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // GET: api/condominiums/{condominiumId}/announcements/{announcementId}/attachments/{attachmentId}/download
    // AllowAnonymous: browsers cannot send Bearer tokens for <img src> requests.
    // Security is provided by 3 unguessable GUIDs in the URL.
    [AllowAnonymous]
    [HttpGet("{announcementId}/attachments/{attachmentId}/download")]
    public async Task<IActionResult> DownloadAttachment(Guid condominiumId, Guid announcementId, Guid attachmentId)
    {

        var attachment = await _context.AnnouncementAttachments
            .Include(a => a.Announcement)
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.AnnouncementId == announcementId);

        if (attachment == null || attachment.Announcement.CondominiumId != condominiumId)
            return NotFound();

        var filePath = Path.Combine(_env.ContentRootPath, attachment.FilePath);
        if (!System.IO.File.Exists(filePath))
            return NotFound("File not found");

        var contentType = attachment.ContentType ?? "application/octet-stream";
        return PhysicalFile(filePath, contentType, attachment.FileName);
    }

    private async Task NotifyAdminsPendingApprovalAsync(Guid condominiumId, Announcement announcement)
    {
        // Notify all active admins in the same condominium that a new approval is pending.
        var admins = await _context.Users
            .Where(u => u.CondominiumId == condominiumId && u.Role == UserRole.Admin && u.IsActive)
            .ToListAsync();

        if (admins.Count == 0)
        {
            return;
        }

        var openUrl = $"/announcements?open={announcement.Id}";
        var notifications = new List<Notification>(admins.Count);

        foreach (var admin in admins)
        {
            notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                Title = "Comunicado pendente de aprovação",
                Message = $"📝 {announcement.Title}\nVer: {openUrl}",
                Type = NotificationType.Alert,
                TargetRole = UserRole.Admin.ToString(),
                TargetUserId = admin.Id,
                CondominiumId = condominiumId,
                SentAt = DateTime.UtcNow,
                IsRead = false
            });
        }

        _context.Notifications.AddRange(notifications);
        await _context.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync(notifications, sendExternalChannels: true);
    }

    // Helper methods
    private AnnouncementDto MapToDto(Announcement announcement, Guid currentUserId)
    {
        var isAnonymous = announcement.IsAnonymous;

        return new AnnouncementDto
        {
            Id = announcement.Id,
            Title = announcement.Title,
            Content = announcement.Content,
            Category = announcement.Category.ToString(),
            Status = announcement.Status.ToString(),
            IsAnonymous = isAnonymous,
            IsPinned = announcement.IsPinned,
            ValidUntil = announcement.ValidUntil,
            CreatedAt = announcement.CreatedAt,
            PublishedAt = announcement.PublishedAt,
            UpdatedAt = announcement.UpdatedAt,
            AuthorId = announcement.AuthorId,
            AuthorName = isAnonymous ? "Anónimo" : announcement.Author?.Name ?? "Unknown",
            CondominiumId = announcement.CondominiumId,
            UnitId = isAnonymous ? null : announcement.UnitId,
            UnitNumber = isAnonymous ? null : announcement.Unit?.Number,
            ApprovedByUserId = announcement.ApprovedByUserId,
            ApprovedByUserName = announcement.ApprovedByUser?.Name,
            ApprovedAt = announcement.ApprovedAt,
            RejectionReason = announcement.RejectionReason,
            TotalReads = announcement.ReadStatuses?.Count ?? 0,
            TotalComments = announcement.Comments?.Count ?? 0,
            TotalAttachments = announcement.Attachments?.Count ?? 0,
            IsReadByCurrentUser = announcement.ReadStatuses?.Any(r => r.UserId == currentUserId) ?? false,
            Attachments = announcement.Attachments?.Select(MapAttachmentToDto).ToList() ?? new(),
            Comments = announcement.Comments?.Select(c => MapCommentToDto(c, null)).ToList() ?? new()
        };
    }

    private AnnouncementAttachmentDto MapAttachmentToDto(AnnouncementAttachment attachment)
    {
        return new AnnouncementAttachmentDto
        {
            Id = attachment.Id,
            AnnouncementId = attachment.AnnouncementId,
            FileName = attachment.FileName,
            FilePath = attachment.FilePath,
            Type = attachment.Type.ToString(),
            FileSize = attachment.FileSize,
            ContentType = attachment.ContentType,
            UploadedAt = attachment.UploadedAt
        };
    }

    private AnnouncementCommentDto MapCommentToDto(AnnouncementComment comment, User? author)
    {
        return new AnnouncementCommentDto
        {
            Id = comment.Id,
            AnnouncementId = comment.AnnouncementId,
            AuthorId = comment.AuthorId,
            AuthorName = comment.IsAnonymous ? "Anónimo" : (author?.Name ?? comment.Author?.Name ?? "Unknown"),
            UnitId = comment.UnitId,
            UnitNumber = comment.Unit?.Number,
            Content = comment.Content,
            IsAnonymous = comment.IsAnonymous,
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt
        };
    }
}

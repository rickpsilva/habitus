using Habitus.Application.DTOs.Announcements;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Api.Middleware;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/condominiums/{condominiumId:guid}/[controller]")]
[RequireFeature("announcements")]
public class AnnouncementsController : ControllerBase
{
    private readonly IAnnouncementService _announcementService;
    private readonly IRepository<Announcement> _announcementRepository;
    private readonly IRepository<AnnouncementAttachment> _attachmentRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IWebHostEnvironment _env;
    private readonly IPlatformSettingsCache _settingsCache;
    private readonly INotificationDispatchService _notificationDispatchService;

    public AnnouncementsController(
        IAnnouncementService announcementService,
        IRepository<Announcement> announcementRepository,
        IRepository<AnnouncementAttachment> attachmentRepository,
        IRepository<User> userRepository,
        IWebHostEnvironment env,
        IPlatformSettingsCache settingsCache,
        INotificationDispatchService notificationDispatchService)
    {
        _announcementService = announcementService;
        _announcementRepository = announcementRepository;
        _attachmentRepository = attachmentRepository;
        _userRepository = userRepository;
        _env = env;
        _settingsCache = settingsCache;
        _notificationDispatchService = notificationDispatchService;
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var userCondominiumClaim = User.FindFirstValue("CondominiumId");
        return Guid.TryParse(userCondominiumClaim, out var userCondominiumId) && userCondominiumId == condominiumId;
    }

    // GET: api/condominiums/{condominiumId:guid}/announcements
    [HttpGet]
    public async Task<ActionResult<List<AnnouncementDto>>> GetAll([FromRoute] Guid condominiumId, [FromQuery] string? status = null)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        var pagedResult = await _announcementService.GetPagedAsync(condominiumId, userId, 1, 100, status, null, null);
        return Ok(pagedResult.Items);
    }

    // GET: api/condominiums/{condominiumId:guid}/announcements/paged
    [HttpGet("paged")]
    public async Task<ActionResult<PaginatedResponse<AnnouncementDto>>> GetPaged(
        [FromRoute] Guid condominiumId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? status = null,
        [FromQuery] string? category = null,
        [FromQuery] string? search = null)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        var result = await _announcementService.GetPagedAsync(condominiumId, userId, page, pageSize, status, category, search);
        return Ok(result);
    }

    // GET: api/condominiums/{condominiumId:guid}/announcements/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<AnnouncementDto>> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        try
        {
            var dto = await _announcementService.GetByIdAsync(condominiumId, id, userId);
            return Ok(dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // GET: api/condominiums/{condominiumId:guid}/announcements/stats
    [HttpGet("stats")]
    public async Task<ActionResult<AnnouncementStatsDto>> GetStats([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        try
        {
            var stats = await _announcementService.GetStatsAsync(condominiumId, userId);
            return Ok(stats);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // GET: api/condominiums/{condominiumId:guid}/announcements/settings
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null || user.CondominiumId != condominiumId)
            return Forbid();

        var settings = await _announcementService.GetSettingsAsync(condominiumId);
        return Ok(settings);
    }

    // POST: api/condominiums/{condominiumId:guid}/announcements
    [HttpPost]
    public async Task<ActionResult<AnnouncementDto>> Create([FromRoute] Guid condominiumId, [FromBody] CreateAnnouncementRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        try
        {
            var dto = await _announcementService.CreateAsync(condominiumId, userId, request);
            return CreatedAtAction(nameof(GetById), new { condominiumId, id = dto.Id }, dto);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // PUT: api/condominiums/{condominiumId:guid}/announcements/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<AnnouncementDto>> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateAnnouncementRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        try
        {
            var dto = await _announcementService.UpdateAsync(condominiumId, id, userId, request);
            return Ok(dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // POST: api/condominiums/{condominiumId:guid}/announcements/{id}/publish
    [HttpPost("{id}/publish")]
    public async Task<IActionResult> Publish([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        try
        {
            await _announcementService.PublishAsync(condominiumId, id, userId);
            return Ok(new { message = "Comunicado submetido para aprovação." });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // POST: api/condominiums/{condominiumId:guid}/announcements/{id}/approve
    [HttpPost("{id}/approve")]
    public async Task<IActionResult> Approve([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] ApproveAnnouncementRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        try
        {
            await _announcementService.ApproveAsync(condominiumId, id, userId, request.IsApproved, request.RejectionReason);
            return Ok(new { message = request.IsApproved ? "Comunicado publicado." : "Comunicado rejeitado." });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // POST: api/condominiums/{condominiumId:guid}/announcements/{id}/pin
    [HttpPost("{id}/pin")]
    public async Task<IActionResult> TogglePin([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        try
        {
            var dto = await _announcementService.TogglePinAsync(condominiumId, id);
            return Ok(new { isPinned = dto.IsPinned });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // DELETE: api/condominiums/{condominiumId:guid}/announcements/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        var isAdmin = user?.Role == UserRole.Admin;
        
        try
        {
            // First get the announcement to delete its attachments
            var announcement = await _announcementRepository.GetByIdWithIncludesAsync(id, nameof(Announcement.Attachments));
            if (announcement == null || announcement.CondominiumId != condominiumId)
                return NotFound();

            // Only author or admin can delete
            if (announcement.AuthorId != userId && !isAdmin)
                return Forbid();

            // Delete attachments from filesystem
            var attachments = await _attachmentRepository.Query().Where(a => a.AnnouncementId == id).ToListAsync();
            foreach (var attachment in attachments)
            {
                var filePath = Path.Combine(_env.ContentRootPath, attachment.FilePath);
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
            }

            await _announcementService.DeleteAsync(condominiumId, id, userId, isAdmin);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // POST: api/condominiums/{condominiumId:guid}/announcements/{id}/comments
    [HttpPost("{id}/comments")]
    public async Task<ActionResult<AnnouncementCommentDto>> AddComment([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] CreateAnnouncementCommentRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        try
        {
            var dto = await _announcementService.AddCommentAsync(condominiumId, id, userId, request);
            return Ok(dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // DELETE: api/condominiums/{condominiumId:guid}/announcements/{announcementId}/comments/{commentId}
    [HttpDelete("{announcementId}/comments/{commentId}")]
    public async Task<IActionResult> DeleteComment([FromRoute] Guid condominiumId, [FromRoute] Guid announcementId, [FromRoute] Guid commentId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        var isAdmin = user?.Role == UserRole.Admin;
        
        try
        {
            await _announcementService.DeleteCommentAsync(condominiumId, commentId, userId, isAdmin);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // POST: api/condominiums/{condominiumId:guid}/announcements/{id}/attachments
    [HttpPost("{id}/attachments")]
    [RequestFormLimits(MultipartBodyLengthLimit = 524288000)] // 500 MB
    [RequestSizeLimit(524288000)] // 500 MB
    public async Task<ActionResult<AnnouncementAttachmentDto>> UploadAttachment([FromRoute] Guid condominiumId, [FromRoute] Guid id, IFormFile file)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        var announcement = await _announcementRepository.GetByIdWithIncludesAsync(id, nameof(Announcement.Attachments));
        if (announcement == null || announcement.CondominiumId != condominiumId) return NotFound();
        if (announcement.AuthorId != userId) return Forbid();
        if (announcement.Status != AnnouncementStatus.Draft) 
            return BadRequest("Só é possível carregar anexos em comunicados em rascunho.");

        // Validate file
        var allowedImageTypes = new[] { ".jpg", ".jpeg", ".png", ".gif" };
        var allowedDocTypes = new[] { ".pdf", ".doc", ".docx", ".txt" };
        var ext = Path.GetExtension(file.FileName).ToLower();
        
        AttachmentType attachmentType;
        if (allowedImageTypes.Contains(ext))
        {
            attachmentType = AttachmentType.Image;
            var imageCount = announcement.Attachments.Count(a => a.Type == AttachmentType.Image);
            if (imageCount >= 5) return BadRequest("Máximo de 5 imagens permitido.");
        }
        else if (allowedDocTypes.Contains(ext))
        {
            attachmentType = AttachmentType.Document;
            var docCount = announcement.Attachments.Count(a => a.Type == AttachmentType.Document);
            if (docCount >= 2) return BadRequest("Máximo de 2 documentos permitido.");
        }
        else
        {
            return BadRequest("Invalid file type");
        }

        var maxUploadSizeBytes = await GetMaxUploadSizeBytesAsync();
        if (file.Length > maxUploadSizeBytes)
            return BadRequest($"File is too large. Maximum upload size (max. {FormatFileSize(maxUploadSizeBytes)}).");

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

        await _attachmentRepository.AddAsync(attachment);
        await _attachmentRepository.SaveChangesAsync();

        return Ok(MapAttachmentToDto(attachment));
    }

    // DELETE: api/condominiums/{condominiumId:guid}/announcements/{announcementId}/attachments/{attachmentId}
    [HttpDelete("{announcementId}/attachments/{attachmentId}")]
    public async Task<IActionResult> DeleteAttachment([FromRoute] Guid condominiumId, [FromRoute] Guid announcementId, [FromRoute] Guid attachmentId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();
        
        var announcement = await _announcementRepository.GetByIdAsync(announcementId);
        if (announcement == null || announcement.CondominiumId != condominiumId) return NotFound();
        if (announcement.AuthorId != userId) return Forbid();

        var attachment = await _attachmentRepository.GetByIdAsync(attachmentId);
        if (attachment == null || attachment.AnnouncementId != announcementId) return NotFound();

        // Delete file
        var filePath = Path.Combine(_env.ContentRootPath, attachment.FilePath);
        if (System.IO.File.Exists(filePath))
        {
            System.IO.File.Delete(filePath);
        }

        await _attachmentRepository.RemoveAsync(attachment);
        await _attachmentRepository.SaveChangesAsync();

        return NoContent();
    }

    // GET: api/condominiums/{condominiumId:guid}/announcements/{announcementId}/attachments/{attachmentId}/download
    // AllowAnonymous: browsers cannot send Bearer tokens for <img src> requests.
    // Security is provided by 3 unguessable GUIDs in the URL.
    [AllowAnonymous]
    [HttpGet("{announcementId}/attachments/{attachmentId}/download")]
    public async Task<IActionResult> DownloadAttachment([FromRoute] Guid condominiumId, [FromRoute] Guid announcementId, [FromRoute] Guid attachmentId)
    {
        var attachment = await _attachmentRepository.GetByIdWithIncludesAsync(attachmentId, nameof(AnnouncementAttachment.Announcement));

        if (attachment == null || attachment.Announcement.CondominiumId != condominiumId)
            return NotFound();

        var filePath = Path.Combine(_env.ContentRootPath, attachment.FilePath);
        if (!System.IO.File.Exists(filePath))
            return NotFound("File not found");

        var contentType = attachment.ContentType ?? "application/octet-stream";
        return PhysicalFile(filePath, contentType, attachment.FileName);
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

    private async Task<int> GetMaxUploadSizeBytesAsync()
    {
        var settings = await _settingsCache.GetUploadAsync();
        return settings?.MaxUploadSizeBytes > 0 ? settings.MaxUploadSizeBytes : 600 * 1024;
    }

    private static string FormatFileSize(long bytes)
    {
        const double kb = 1024;
        const double mb = 1024 * 1024;

        if (bytes >= mb)
        {
            return $"{bytes / mb:0.##} MB";
        }

        return $"{bytes / kb:0.##} KB";
    }
}

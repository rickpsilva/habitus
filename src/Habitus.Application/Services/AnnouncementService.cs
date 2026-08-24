using Habitus.Application.DTOs.Announcements;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using System.Linq.Expressions;

namespace Habitus.Application.Services;

public class AnnouncementService : IAnnouncementService
{
    private readonly IRepository<Announcement> _announcementRepository;
    private readonly IRepository<AnnouncementComment> _commentRepository;
    private readonly IRepository<AnnouncementAttachment> _attachmentRepository;
    private readonly IRepository<CommunicationSettings> _settingsRepository;
    private readonly IRepository<Notification> _notificationRepository;
    private readonly IRepository<User> _userRepository;
    private readonly INotificationDispatchService _notificationDispatchService;

    public AnnouncementService(
        IRepository<Announcement> announcementRepository,
        IRepository<AnnouncementComment> commentRepository,
        IRepository<AnnouncementAttachment> attachmentRepository,
        IRepository<CommunicationSettings> settingsRepository,
        IRepository<Notification> notificationRepository,
        IRepository<User> userRepository,
        INotificationDispatchService notificationDispatchService)
    {
        _announcementRepository = announcementRepository;
        _commentRepository = commentRepository;
        _attachmentRepository = attachmentRepository;
        _settingsRepository = settingsRepository;
        _notificationRepository = notificationRepository;
        _userRepository = userRepository;
        _notificationDispatchService = notificationDispatchService;
    }

    public async Task<AnnouncementDto> CreateAsync(Guid condominiumId, Guid authorId, CreateAnnouncementRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<AnnouncementCategory>(request.Category, out var category))
            throw new ArgumentException("Invalid category");

        var status = request.PublishImmediately
            ? AnnouncementStatus.PendingApproval
            : AnnouncementStatus.Draft;

        var user = await _userRepository.GetByIdAsync(authorId);
        var unitId = user?.UnitId;

        var announcement = new Announcement
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Content = request.Content,
            Category = category,
            Status = status,
            IsAnonymous = request.IsAnonymous,
            ValidUntil = request.ValidUntil,
            AuthorId = authorId,
            CondominiumId = condominiumId,
            UnitId = unitId,
            CreatedAt = DateTime.UtcNow
        };

        await _announcementRepository.AddAsync(announcement);
        await _announcementRepository.SaveChangesAsync(cancellationToken);

        if (status == AnnouncementStatus.PendingApproval)
        {
            await NotifyAdminsPendingApprovalAsync(condominiumId, announcement, cancellationToken);
        }

        return MapToDto(announcement, authorId);
    }

    public async Task<AnnouncementDto> UpdateAsync(Guid condominiumId, Guid announcementId, Guid authorId, UpdateAnnouncementRequest request, CancellationToken cancellationToken = default)
    {
        var announcement = await _announcementRepository.GetByIdWithIncludesAsync(announcementId, nameof(Announcement.Author), nameof(Announcement.Unit), nameof(Announcement.ApprovedByUser), nameof(Announcement.Attachments), nameof(Announcement.Comments), nameof(Announcement.ReadStatuses));

        if (announcement == null || announcement.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Announcement not found");

        if (announcement.AuthorId != authorId)
            throw new UnauthorizedAccessException("Only the author can edit the announcement");

        if (announcement.Status != AnnouncementStatus.Draft)
            throw new InvalidOperationException("Only draft announcements can be edited");

        if (!Enum.TryParse<AnnouncementCategory>(request.Category, out var category))
            throw new ArgumentException("Invalid category");

        announcement.Title = request.Title;
        announcement.Content = request.Content;
        announcement.Category = category;
        announcement.IsAnonymous = request.IsAnonymous;
        announcement.ValidUntil = request.ValidUntil;
        announcement.UpdatedAt = DateTime.UtcNow;

        await _announcementRepository.SaveChangesAsync(cancellationToken);

        return MapToDto(announcement, authorId);
    }

    public async Task<AnnouncementDto> GetByIdAsync(Guid condominiumId, Guid announcementId, Guid userId, CancellationToken cancellationToken = default)
    {
        var announcement = await _announcementRepository.GetByIdWithIncludesAsync(announcementId, 
            nameof(Announcement.Author),
            nameof(Announcement.Unit),
            nameof(Announcement.ApprovedByUser),
            nameof(Announcement.Attachments),
            "Comments",
            "Comments.Author",
            "Comments.Unit",
            nameof(Announcement.ReadStatuses));

        if (announcement == null || announcement.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Announcement not found");

        var user = await _userRepository.GetByIdAsync(userId);
        var isAdmin = user?.Role == UserRole.Admin;

        // Drafts are private to author only.
        if (announcement.Status == AnnouncementStatus.Draft && announcement.AuthorId != userId)
            throw new UnauthorizedAccessException("Cannot access draft announcements by other users");

        // Unpublished announcements are not visible to other residents.
        if (announcement.Status != AnnouncementStatus.Published && announcement.AuthorId != userId && !isAdmin)
            throw new UnauthorizedAccessException("Cannot access unpublished announcements");

        // Mark as read if published
        if (announcement.Status == AnnouncementStatus.Published)
        {
            var existingRead = announcement.ReadStatuses?.FirstOrDefault(r => r.UserId == userId);
            if (existingRead == null)
            {
                announcement.ReadStatuses?.Add(new AnnouncementReadStatus
                {
                    Id = Guid.NewGuid(),
                    AnnouncementId = announcementId,
                    UserId = userId,
                    ReadAt = DateTime.UtcNow
                });
                await _announcementRepository.SaveChangesAsync(cancellationToken);
            }
        }

        return MapToDto(announcement, userId);
    }

    public async Task<PaginatedResponse<AnnouncementDto>> GetPagedAsync(Guid condominiumId, Guid userId, int page, int pageSize, string? status, string? category, string? search, CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var user = await _userRepository.GetByIdAsync(userId);
        var isAdmin = user?.Role == UserRole.Admin;

        Expression<Func<Announcement, bool>> filter = a => a.CondominiumId == condominiumId;

        // Visibility rules must match GetAll exactly (never widen visibility).
        if (isAdmin)
        {
            filter = filter.And(a => a.Status != AnnouncementStatus.Draft || a.AuthorId == userId);
        }
        else
        {
            filter = filter.And(a => a.Status == AnnouncementStatus.Published || a.AuthorId == userId);
        }

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<AnnouncementStatus>(status, out var statusEnum))
        {
            filter = filter.And(a => a.Status == statusEnum);
        }

        if (!string.IsNullOrEmpty(category) && category != "All"
            && Enum.TryParse<AnnouncementCategory>(category, out var categoryEnum))
        {
            filter = filter.And(a => a.Category == categoryEnum);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            filter = filter.And(a => a.Title.ToLower().Contains(term) || a.Content.ToLower().Contains(term));
        }

        var totalItems = await _announcementRepository.CountAsync(filter, cancellationToken);
        var announcements = await _announcementRepository.GetFilteredWithIncludesAsync(
            filter,
            a => a.IsPinned,
            true, // descending for IsPinned (true first)
            nameof(Announcement.Author),
            nameof(Announcement.Unit),
            nameof(Announcement.ApprovedByUser),
            nameof(Announcement.Attachments),
            nameof(Announcement.Comments),
            nameof(Announcement.ReadStatuses)
        );

        // Apply secondary sort by PublishedAt/CreatedAt in memory since we can't easily do multi-sort in expression
        announcements = announcements
            .OrderByDescending(a => a.IsPinned)
            .ThenByDescending(a => a.PublishedAt ?? a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var dtos = announcements.Select(a => MapToDto(a, userId)).ToList();

        return new PaginatedResponse<AnnouncementDto>
        {
            Items = dtos,
            Page = page,
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
        };
    }

    public async Task<AnnouncementStatsDto> GetStatsAsync(Guid condominiumId, Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        var isAdmin = user?.Role == UserRole.Admin;

        Expression<Func<Announcement, bool>> baseFilter = a => a.CondominiumId == condominiumId;

        var visibleFilter = isAdmin
            ? baseFilter.And(a => a.Status != AnnouncementStatus.Draft || a.AuthorId == userId)
            : baseFilter.And(a => a.Status == AnnouncementStatus.Published || a.AuthorId == userId);

        var publishedVisibleFilter = visibleFilter.And(a => a.Status == AnnouncementStatus.Published);

        var stats = new AnnouncementStatsDto
        {
            TotalAnnouncements = await _announcementRepository.CountAsync(visibleFilter, cancellationToken),
            PendingApproval = isAdmin ? await _announcementRepository.CountAsync(visibleFilter.And(a => a.Status == AnnouncementStatus.PendingApproval), cancellationToken) : 0,
            Published = await _announcementRepository.CountAsync(publishedVisibleFilter, cancellationToken),
            MyDrafts = await _announcementRepository.CountAsync(baseFilter.And(a => a.AuthorId == userId && a.Status == AnnouncementStatus.Draft), cancellationToken),
            Unread = await _announcementRepository.CountAsync(publishedVisibleFilter.And(a => !a.ReadStatuses.Any(r => r.UserId == userId)), cancellationToken)
        };

        return stats;
    }

    public async Task<AnnouncementDto> PublishAsync(Guid condominiumId, Guid announcementId, Guid authorId, CancellationToken cancellationToken = default)
    {
        var announcement = await _announcementRepository.GetByIdWithIncludesAsync(announcementId, nameof(Announcement.Author), nameof(Announcement.Attachments));

        if (announcement == null || announcement.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Announcement not found");

        if (announcement.AuthorId != authorId)
            throw new UnauthorizedAccessException("Only the author can publish the announcement");

        if (announcement.Status != AnnouncementStatus.Draft)
            throw new InvalidOperationException("Only draft announcements can be published");

        announcement.Status = AnnouncementStatus.PendingApproval;
        announcement.UpdatedAt = DateTime.UtcNow;

        await NotifyAdminsPendingApprovalAsync(condominiumId, announcement, cancellationToken);

        return MapToDto(announcement, authorId);
    }

    public async Task<AnnouncementDto> ApproveAsync(Guid condominiumId, Guid announcementId, Guid adminId, bool isApproved, string? rejectionReason, CancellationToken cancellationToken = default)
    {
        var admin = await _userRepository.GetByIdAsync(adminId);
        if (admin == null || admin.Role != UserRole.Admin)
            throw new UnauthorizedAccessException("Only admins can approve/reject announcements");

        var announcement = await _announcementRepository.GetByIdWithIncludesAsync(announcementId, nameof(Announcement.Author), nameof(Announcement.Attachments));

        if (announcement == null || announcement.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Announcement not found");

        if (announcement.Status != AnnouncementStatus.PendingApproval)
            throw new InvalidOperationException("Only pending announcements can be approved/rejected");

        if (isApproved)
        {
            announcement.Status = AnnouncementStatus.Published;
            announcement.ApprovedByUserId = adminId;
            announcement.ApprovedAt = DateTime.UtcNow;
            announcement.PublishedAt = DateTime.UtcNow;

            // Create notifications for all users in condominium
            var condoUsers = await _userRepository.ToListAsync(
                u => u.CondominiumId == condominiumId && u.Id != announcement.AuthorId && u.IsActive,
                cancellationToken);

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
                await _notificationRepository.AddAsync(notification);
                notifications.Add(notification);
            }

            await _announcementRepository.SaveChangesAsync(cancellationToken);
            await _notificationDispatchService.DispatchAsync(notifications, sendExternalChannels: false);
        }
        else
        {
            announcement.Status = AnnouncementStatus.Rejected;
            announcement.RejectionReason = rejectionReason;
            await _announcementRepository.SaveChangesAsync(cancellationToken);
        }

        return MapToDto(announcement, adminId);
    }

    public async Task<AnnouncementDto> TogglePinAsync(Guid condominiumId, Guid announcementId, CancellationToken cancellationToken = default)
    {
        var announcement = await _announcementRepository.GetByIdAsync(announcementId);

        if (announcement == null || announcement.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Announcement not found");

        announcement.IsPinned = !announcement.IsPinned;
        await _announcementRepository.SaveChangesAsync(cancellationToken);

        return MapToDto(announcement, Guid.Empty);
    }

    public async Task DeleteAsync(Guid condominiumId, Guid announcementId, Guid userId, bool isAdmin, CancellationToken cancellationToken = default)
    {
        var announcement = await _announcementRepository.GetByIdWithIncludesAsync(announcementId, nameof(Announcement.Attachments));

        if (announcement == null || announcement.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Announcement not found");

        // Only author or admin can delete
        if (announcement.AuthorId != userId && !isAdmin)
            throw new UnauthorizedAccessException("Only author or admin can delete");

        // Delete attachments from filesystem (would need IWebHostEnvironment - keeping in controller for now)
        // The controller handles filesystem cleanup

        await _announcementRepository.RemoveAsync(announcement);
        await _announcementRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task<AnnouncementCommentDto> AddCommentAsync(Guid condominiumId, Guid announcementId, Guid authorId, CreateAnnouncementCommentRequest request, CancellationToken cancellationToken = default)
    {
        // Check if comments are allowed
        var settings = await _settingsRepository.FirstOrDefaultAsync(
            s => s.CondominiumId == condominiumId, cancellationToken);
        if (settings?.AllowAnnouncementComments == false)
            throw new InvalidOperationException("Comments are disabled for this condominium");

        var announcement = await _announcementRepository.GetByIdWithIncludesAsync(announcementId, nameof(Announcement.Author));
        if (announcement == null || announcement.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Announcement not found");

        // Check if announcement is archived
        if (announcement.Status == AnnouncementStatus.Archived)
            throw new InvalidOperationException("Não é possível comentar em comunicados arquivados");

        if (announcement.Status != AnnouncementStatus.Published)
            throw new InvalidOperationException("Cannot comment on unpublished announcements");

        var user = await _userRepository.GetByIdAsync(authorId);
        var unitId = user?.UnitId;

        var comment = new AnnouncementComment
        {
            Id = Guid.NewGuid(),
            AnnouncementId = announcementId,
            AuthorId = authorId,
            UnitId = unitId,
            Content = request.Content,
            IsAnonymous = request.IsAnonymous,
            CreatedAt = DateTime.UtcNow
        };

        await _commentRepository.AddAsync(comment);
        await _commentRepository.SaveChangesAsync(cancellationToken);

        // Notify announcement author
        if (announcement.AuthorId != authorId)
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
            await _notificationRepository.AddAsync(notification);
            await _notificationRepository.SaveChangesAsync(cancellationToken);
            await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: true);
        }

        return MapCommentToDto(comment, user);
    }

    public async Task<AnnouncementCommentDto> UpdateCommentAsync(Guid condominiumId, Guid announcementId, Guid commentId, Guid authorId, UpdateAnnouncementCommentRequest request, CancellationToken cancellationToken = default)
    {
        var comment = await _commentRepository.GetByIdWithIncludesAsync(commentId, nameof(AnnouncementComment.Author), nameof(AnnouncementComment.Unit));
        
        if (comment == null || comment.AnnouncementId != announcementId)
            throw new KeyNotFoundException("Comment not found");

        if (comment.AuthorId != authorId)
            throw new UnauthorizedAccessException("Only the author can edit the comment");

        comment.Content = request.Content;
        comment.UpdatedAt = DateTime.UtcNow;

        await _commentRepository.SaveChangesAsync(cancellationToken);

        return MapCommentToDto(comment, comment.Author);
    }

    public async Task DeleteCommentAsync(Guid condominiumId, Guid commentId, Guid userId, bool isAdmin, CancellationToken cancellationToken = default)
    {
        var comment = await _commentRepository.GetByIdAsync(commentId);

        if (comment == null)
            throw new KeyNotFoundException("Comment not found");

        // Only author or admin can delete
        if (comment.AuthorId != userId && !isAdmin)
            throw new UnauthorizedAccessException("Only author or admin can delete comment");

        await _commentRepository.RemoveAsync(comment);
        await _commentRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task<AnnouncementSettingsDto> GetSettingsAsync(Guid condominiumId, CancellationToken cancellationToken = default)
    {
        var settings = await _settingsRepository.FirstOrDefaultAsync(
            s => s.CondominiumId == condominiumId, cancellationToken);

        return new AnnouncementSettingsDto
        {
            AllowAnnouncementComments = settings?.AllowAnnouncementComments ?? true
        };
    }

    public async Task<AnnouncementSettingsDto> UpdateSettingsAsync(Guid condominiumId, AnnouncementSettingsDto settings, CancellationToken cancellationToken = default)
    {
        var existing = await _settingsRepository.FirstOrDefaultAsync(
            s => s.CondominiumId == condominiumId, cancellationToken);

        if (existing == null)
        {
            existing = new CommunicationSettings
            {
                Id = Guid.NewGuid(),
                CondominiumId = condominiumId,
                AllowAnnouncementComments = settings.AllowAnnouncementComments
            };
            await _settingsRepository.AddAsync(existing);
        }
        else
        {
            existing.AllowAnnouncementComments = settings.AllowAnnouncementComments;
        }

        await _settingsRepository.SaveChangesAsync(cancellationToken);

        return new AnnouncementSettingsDto
        {
            AllowAnnouncementComments = existing.AllowAnnouncementComments
        };
    }

    public async Task<int> ArchiveExpiredAnnouncementsAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        
        // Get all announcements that are Published and have ValidUntil in the past
        Expression<Func<Announcement, bool>> filter = a => a.Status == AnnouncementStatus.Published 
                     && a.ValidUntil.HasValue 
                     && a.ValidUntil.Value < now;

        var expiredAnnouncements = await _announcementRepository.ToListAsync(filter, cancellationToken);

        int archivedCount = 0;
        foreach (var announcement in expiredAnnouncements)
        {
            announcement.Status = AnnouncementStatus.Archived;
            announcement.UpdatedAt = DateTime.UtcNow;
            archivedCount++;
        }

        if (archivedCount > 0)
        {
            await _announcementRepository.SaveChangesAsync(cancellationToken);
        }

        return archivedCount;
    }

    private async Task NotifyAdminsPendingApprovalAsync(Guid condominiumId, Announcement announcement, CancellationToken cancellationToken)
    {
        var admins = await _userRepository.ToListAsync(
            u => u.CondominiumId == condominiumId && u.Role == UserRole.Admin && u.IsActive,
            cancellationToken);

        var notifications = new List<Notification>();
        foreach (var admin in admins)
        {
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                Title = "Comunicado Pendente de Aprovação",
                Message = $"📋 Novo comunicado aguarda aprovação: {announcement.Title}",
                Type = NotificationType.Info,
                TargetRole = admin.Role.ToString(),
                TargetUserId = admin.Id,
                CondominiumId = condominiumId,
                SentAt = DateTime.UtcNow,
                IsRead = false
            };
            await _notificationRepository.AddAsync(notification);
            notifications.Add(notification);
        }

        await _notificationRepository.SaveChangesAsync(cancellationToken);
        await _notificationDispatchService.DispatchAsync(notifications, sendExternalChannels: false);
    }

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
        var isAnonymous = comment.IsAnonymous;
        return new AnnouncementCommentDto
        {
            Id = comment.Id,
            AnnouncementId = comment.AnnouncementId,
            AuthorId = comment.AuthorId,
            AuthorName = isAnonymous ? "Anónimo" : author?.Name ?? comment.Author?.Name ?? "Unknown",
            UnitId = isAnonymous ? null : comment.UnitId,
            UnitNumber = isAnonymous ? null : comment.Unit?.Number,
            Content = comment.Content,
            IsAnonymous = isAnonymous,
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt
        };
    }
}
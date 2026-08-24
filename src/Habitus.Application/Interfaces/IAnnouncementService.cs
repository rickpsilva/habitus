using Habitus.Application.DTOs.Announcements;
using Habitus.Application.DTOs.Common;
using System.Threading;

namespace Habitus.Application.Interfaces;

public interface IAnnouncementService
{
    Task<AnnouncementDto> CreateAsync(Guid condominiumId, Guid authorId, CreateAnnouncementRequest request, CancellationToken cancellationToken = default);
    Task<AnnouncementDto> UpdateAsync(Guid condominiumId, Guid announcementId, Guid authorId, UpdateAnnouncementRequest request, CancellationToken cancellationToken = default);
    Task<AnnouncementDto> GetByIdAsync(Guid condominiumId, Guid announcementId, Guid userId, CancellationToken cancellationToken = default);
    Task<PaginatedResponse<AnnouncementDto>> GetPagedAsync(Guid condominiumId, Guid userId, int page, int pageSize, string? status, string? category, string? search, CancellationToken cancellationToken = default);
    Task<AnnouncementStatsDto> GetStatsAsync(Guid condominiumId, Guid userId, CancellationToken cancellationToken = default);
    Task<AnnouncementDto> PublishAsync(Guid condominiumId, Guid announcementId, Guid authorId, CancellationToken cancellationToken = default);
    Task<AnnouncementDto> ApproveAsync(Guid condominiumId, Guid announcementId, Guid adminId, bool isApproved, string? rejectionReason, CancellationToken cancellationToken = default);
    Task<AnnouncementDto> TogglePinAsync(Guid condominiumId, Guid announcementId, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid condominiumId, Guid announcementId, Guid userId, bool isAdmin, CancellationToken cancellationToken = default);
    Task<AnnouncementCommentDto> AddCommentAsync(Guid condominiumId, Guid announcementId, Guid authorId, CreateAnnouncementCommentRequest request, CancellationToken cancellationToken = default);
    Task<AnnouncementCommentDto> UpdateCommentAsync(Guid condominiumId, Guid announcementId, Guid commentId, Guid authorId, UpdateAnnouncementCommentRequest request, CancellationToken cancellationToken = default);
    Task DeleteCommentAsync(Guid condominiumId, Guid commentId, Guid userId, bool isAdmin, CancellationToken cancellationToken = default);
    Task<AnnouncementSettingsDto> GetSettingsAsync(Guid condominiumId, CancellationToken cancellationToken = default);
    Task<AnnouncementSettingsDto> UpdateSettingsAsync(Guid condominiumId, AnnouncementSettingsDto settings, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Archives all announcements whose ValidUntil date has passed and are currently Published.
    /// Returns the number of announcements archived.
    /// </summary>
    Task<int> ArchiveExpiredAnnouncementsAsync(CancellationToken cancellationToken = default);
}
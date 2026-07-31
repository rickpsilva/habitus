using System.Linq.Expressions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public interface INotificationService
{
    Task<IEnumerable<Notification>> GetAllOrderedAsync();
    Task<PaginatedResponse<Notification>> GetPagedAsync(int page, int pageSize, Guid condominiumId, string userRole, Guid userId);
    Task<Notification?> GetByIdAsync(Guid id);
    Task MarkAsReadAsync(Guid id, Guid condominiumId, string userRole, Guid userId);
    Task MarkAllAsReadAsync(Guid condominiumId, string userRole, Guid userId);
    Task DeleteAllAsync(Guid condominiumId);
}

public class NotificationService : INotificationService
{
    private readonly IRepository<Notification> _repository;

    public NotificationService(IRepository<Notification> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<Notification>> GetAllOrderedAsync()
    {
        var notifications = await _repository.GetAllAsync();
        return notifications.OrderByDescending(n => n.SentAt).ToList();
    }

    private static bool IsManagerRole(string userRole)
    {
        return string.Equals(userRole, "Manager", StringComparison.OrdinalIgnoreCase);
    }

    private static bool CanUserAccessNotification(Notification notification, Guid condominiumId, string userRole, Guid userId)
    {
        // Managers only receive manager-targeted or direct notifications, never generic condominium notifications.
        if (IsManagerRole(userRole))
        {
            return (notification.TargetUserId.HasValue && notification.TargetUserId.Value == userId) ||
                   (!notification.TargetUserId.HasValue && string.Equals(notification.TargetRole, "Manager", StringComparison.OrdinalIgnoreCase));
        }

        return notification.CondominiumId == condominiumId &&
               ((notification.TargetUserId.HasValue && notification.TargetUserId.Value == userId) ||
                (!notification.TargetUserId.HasValue && (notification.TargetRole == userRole || string.IsNullOrEmpty(notification.TargetRole))));
    }

    public async Task<PaginatedResponse<Notification>> GetPagedAsync(int page, int pageSize, Guid condominiumId, string userRole, Guid userId)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var filter = BuildAccessFilter(condominiumId, userRole, userId);

        return await _repository.GetPagedAsync(page, pageSize, filter, n => n.SentAt, descending: true);
    }

    /// <summary>
    /// Builds the SQL-translatable equivalent of <see cref="CanUserAccessNotification"/>: managers
    /// only see manager-targeted or direct notifications, everyone else sees condominium-scoped
    /// notifications targeted at their role (or untargeted) plus their own direct notifications.
    /// Shared by <see cref="GetPagedAsync"/> and <see cref="MarkAllAsReadAsync"/>.
    /// </summary>
    private static Expression<Func<Notification, bool>> BuildAccessFilter(Guid condominiumId, string userRole, Guid userId)
    {
        var isManager = IsManagerRole(userRole);

        return isManager
            ? n => (n.TargetUserId.HasValue && n.TargetUserId.Value == userId) ||
                   (!n.TargetUserId.HasValue && n.TargetRole != null && n.TargetRole.ToLower() == "manager")
            : n => n.CondominiumId == condominiumId &&
                   ((n.TargetUserId.HasValue && n.TargetUserId.Value == userId) ||
                    (!n.TargetUserId.HasValue && (n.TargetRole == userRole || n.TargetRole == null || n.TargetRole == "")));
    }

    public async Task<Notification?> GetByIdAsync(Guid id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task MarkAsReadAsync(Guid id, Guid condominiumId, string userRole, Guid userId)
    {
        var notification = await _repository.GetByIdAsync(id);
        if (notification == null) return;

        var canAccess = CanUserAccessNotification(notification, condominiumId, userRole, userId);
        if (!canAccess) return;
        
        notification.IsRead = true;
        _repository.Update(notification);
        await _repository.SaveChangesAsync();
    }

    public async Task MarkAllAsReadAsync(Guid condominiumId, string userRole, Guid userId)
    {
        var accessFilter = BuildAccessFilter(condominiumId, userRole, userId);

        var unreadAccessibleNotifications = (await _repository.FindAsync(accessFilter))
            .Where(n => !n.IsRead)
            .ToList();
        
        foreach (var notification in unreadAccessibleNotifications)
        {
            notification.IsRead = true;
            _repository.Update(notification);
        }
        
        await _repository.SaveChangesAsync();
    }

    public async Task DeleteAllAsync(Guid condominiumId)
    {
        var notifications = await _repository.FindAsync(n => 
            n.CondominiumId == condominiumId);
        
        foreach (var notification in notifications)
        {
            _repository.Remove(notification);
        }
        
        await _repository.SaveChangesAsync();
    }
}

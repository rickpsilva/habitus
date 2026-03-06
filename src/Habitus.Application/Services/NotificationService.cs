using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public interface INotificationService
{
    Task<IEnumerable<Notification>> GetAllOrderedAsync();
    Task<PaginatedResponse<Notification>> GetPagedAsync(int page, int pageSize);
    Task<Notification?> GetByIdAsync(Guid id);
    Task MarkAsReadAsync(Guid id);
    Task MarkAllAsReadAsync(Guid condominiumId, string userId);
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

    public async Task<PaginatedResponse<Notification>> GetPagedAsync(int page, int pageSize)
    {
        var allNotifications = await _repository.GetAllAsync();
        var ordered = allNotifications.OrderByDescending(n => n.SentAt).ToList();
        
        var totalItems = ordered.Count;
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        
        var items = ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new PaginatedResponse<Notification>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = totalPages
        };
    }

    public async Task<Notification?> GetByIdAsync(Guid id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task MarkAsReadAsync(Guid id)
    {
        var notification = await _repository.GetByIdAsync(id);
        if (notification == null) return;
        
        notification.IsRead = true;
        _repository.Update(notification);
        await _repository.SaveChangesAsync();
    }

    public async Task MarkAllAsReadAsync(Guid condominiumId, string userId)
    {
        var notifications = await _repository.FindAsync(n => 
            n.CondominiumId == condominiumId && !n.IsRead);
        
        foreach (var notification in notifications)
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

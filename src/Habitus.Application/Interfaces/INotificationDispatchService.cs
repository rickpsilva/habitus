using Habitus.Domain.Entities;

namespace Habitus.Application.Interfaces;

public interface INotificationDispatchService
{
    Task DispatchAsync(IEnumerable<Notification> notifications, bool sendExternalChannels = true);
}

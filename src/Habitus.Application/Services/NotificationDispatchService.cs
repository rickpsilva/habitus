using System.Security.Cryptography;
using System.Text;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class NotificationDispatchService : INotificationDispatchService
{
    private const string PendingStatus = "Pending";
    private const string SentStatus = "Sent";
    private const string FailedStatus = "Failed";
    private const int MaxAttempts = 3;
    private static readonly TimeSpan RetryCooldown = TimeSpan.FromMinutes(1);

    private readonly IRepository<User> _userRepository;
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<CommunicationSettings> _settingsRepository;
    private readonly IRepository<NotificationDispatchDelivery> _dispatchDeliveryRepository;
    private readonly IEmailService _emailService;
    private readonly IWhatsAppService _whatsAppService;
    private readonly IEncryptionService _encryptionService;

    public NotificationDispatchService(
        IRepository<User> userRepository,
        IRepository<Condominium> condominiumRepository,
        IRepository<CommunicationSettings> settingsRepository,
        IRepository<NotificationDispatchDelivery> dispatchDeliveryRepository,
        IEmailService emailService,
        IWhatsAppService whatsAppService,
        IEncryptionService encryptionService)
    {
        _userRepository = userRepository;
        _condominiumRepository = condominiumRepository;
        _settingsRepository = settingsRepository;
        _dispatchDeliveryRepository = dispatchDeliveryRepository;
        _emailService = emailService;
        _whatsAppService = whatsAppService;
        _encryptionService = encryptionService;
    }

    public async Task DispatchAsync(IEnumerable<Notification> notifications, bool sendExternalChannels = true)
    {
        var batch = notifications?.ToList() ?? new List<Notification>();
        if (batch.Count == 0 || !sendExternalChannels) return;

        var condominiumId = batch[0].CondominiumId;
        if (batch.Any(n => n.CondominiumId != condominiumId))
            throw new InvalidOperationException("All notifications in a dispatch batch must belong to the same condominium.");

        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);

        var settings = (await _settingsRepository.FindAsync(s => s.CondominiumId == condominiumId)).FirstOrDefault();
        if (settings == null) return;

        if (settings.EmailEnabled)
        {
            // Handle Admin role notifications (sent to condominium email)
            var adminNotifications = batch.Where(n => ParseRole(n.TargetRole) == UserRole.Admin).ToList();
            if (adminNotifications.Count > 0 && condominium != null)
            {
                var condominiumEmail = GetCondominiumEmail(condominium);
                if (!string.IsNullOrWhiteSpace(condominiumEmail))
                {
                    var dispatchKeyPrefix = BuildDispatchKeyPrefix(condominiumId, adminNotifications);
                    var condominiumEmailHash = ComputeEmailHash(condominiumEmail);
                    var delivery = await TryReserveDeliveryAsync(condominiumId, "email", dispatchKeyPrefix, null, condominiumEmailHash);
                    if (delivery != null)
                    {
                        var subject = adminNotifications.Count == 1
                            ? adminNotifications[0].Title
                            : $"{adminNotifications.Count} novas notificacoes";
                        var body = BuildEmailBody(adminNotifications);

                        try
                        {
                            await _emailService.SendAsync(
                                condominiumEmail,
                                subject,
                                body,
                                EmailSenderType.Condominium,
                                condominiumId);
                            await MarkDeliverySentAsync(delivery);
                        }
                        catch (Exception ex)
                        {
                            await MarkDeliveryFailedAsync(delivery, ex.Message);
                        }
                    }
                }
            }

            // Handle Resident/other user notifications
            var activeUsersById = await GetActiveUsersByIdAsync(condominiumId);
            var notificationsByUserId = ResolveEmailNotifications(batch, condominium, activeUsersById);

            foreach (var item in notificationsByUserId)
            {
                var recipientUserId = item.Key;
                var recipientNotifications = item.Value;
                var dispatchKeyPrefix = BuildDispatchKeyPrefix(condominiumId, recipientNotifications);
                var delivery = await TryReserveDeliveryAsync(condominiumId, "email", dispatchKeyPrefix, recipientUserId, null);
                if (delivery == null) continue;

                var subject = recipientNotifications.Count == 1
                    ? recipientNotifications[0].Title
                    : $"{recipientNotifications.Count} novas notificacoes";
                var body = BuildEmailBody(recipientNotifications);

                try
                {
                    var user = activeUsersById[recipientUserId];
                    var recipientEmail = GetUserEmail(user);
                    
                    await _emailService.SendAsync(
                        recipientEmail,
                        subject,
                        body,
                        EmailSenderType.Condominium,
                        condominiumId);
                    await MarkDeliverySentAsync(delivery);
                }
                catch (Exception ex)
                {
                    await MarkDeliveryFailedAsync(delivery, ex.Message);
                }
            }
        }

        if (settings.WhatsAppEnabled && !string.IsNullOrWhiteSpace(settings.WhatsAppGroupId))
        {
            var groupId = settings.WhatsAppGroupId!.Trim();
            var dispatchKeyPrefix = BuildDispatchKeyPrefix(condominiumId, batch);
            var delivery = await TryReserveDeliveryAsync(condominiumId, "whatsapp", dispatchKeyPrefix, null, groupId);
            if (delivery != null)
            {
                var message = BuildWhatsAppBody(batch);
                try
                {
                    await _whatsAppService.SendGroupMessageAsync(groupId, message);
                    await MarkDeliverySentAsync(delivery);
                }
                catch (Exception ex)
                {
                    await MarkDeliveryFailedAsync(delivery, ex.Message);
                }
            }
        }
    }

    private async Task<NotificationDispatchDelivery?> TryReserveDeliveryAsync(Guid condominiumId, string channel, string dispatchKey, Guid? recipientUserId, string? recipientExternalId)
    {
        var now = DateTime.UtcNow;

        var existing = (await _dispatchDeliveryRepository.FindAsync(d =>
            d.Channel == channel &&
            d.DispatchKey == dispatchKey &&
            d.RecipientUserId == recipientUserId &&
            d.RecipientExternalId == recipientExternalId)).FirstOrDefault();

        if (existing != null)
        {
            if (existing.Status == SentStatus) return null;
            if (existing.Status == PendingStatus) return null;

            var canRetry = existing.Status == FailedStatus &&
                           existing.Attempts < MaxAttempts &&
                           (!existing.LastAttemptAt.HasValue || (now - existing.LastAttemptAt.Value) >= RetryCooldown);

            if (!canRetry) return null;

            existing.Status = PendingStatus;
            existing.Attempts += 1;
            existing.LastAttemptAt = now;
            existing.LastError = null;
            existing.UpdatedAt = now;
            _dispatchDeliveryRepository.Update(existing);
            await _dispatchDeliveryRepository.SaveChangesAsync();
            return existing;
        }

        var delivery = new NotificationDispatchDelivery
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Channel = channel,
            DispatchKey = dispatchKey,
            RecipientUserId = recipientUserId,
            RecipientExternalId = recipientExternalId,
            Status = PendingStatus,
            Attempts = 1,
            LastAttemptAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            await _dispatchDeliveryRepository.AddAsync(delivery);
            await _dispatchDeliveryRepository.SaveChangesAsync();
            return delivery;
        }
        catch
        {
            // Unique index protects against race conditions; duplicate means already dispatched.
            return null;
        }
    }

    private async Task MarkDeliverySentAsync(NotificationDispatchDelivery delivery)
    {
        delivery.Status = SentStatus;
        delivery.SentAt = DateTime.UtcNow;
        delivery.LastError = null;
        delivery.UpdatedAt = DateTime.UtcNow;
        _dispatchDeliveryRepository.Update(delivery);
        await _dispatchDeliveryRepository.SaveChangesAsync();
    }

    private async Task MarkDeliveryFailedAsync(NotificationDispatchDelivery delivery, string error)
    {
        delivery.Status = FailedStatus;
        delivery.LastError = error.Length > 2000 ? error[..2000] : error;
        delivery.UpdatedAt = DateTime.UtcNow;
        _dispatchDeliveryRepository.Update(delivery);
        await _dispatchDeliveryRepository.SaveChangesAsync();
    }

    private async Task<Dictionary<Guid, User>> GetActiveUsersByIdAsync(Guid condominiumId)
    {
        var users = (await _userRepository.FindAsync(u => u.CondominiumId == condominiumId && u.IsActive))
            .GroupBy(u => u.Id)
            .ToDictionary(g => g.Key, g => g.First());

        return users;
    }

    private Dictionary<Guid, List<Notification>> ResolveEmailNotifications(
        List<Notification> notifications,
        Condominium? condominium,
        IReadOnlyDictionary<Guid, User> activeUsersById)
    {
        var notificationsByUserId = new Dictionary<Guid, List<Notification>>();

        foreach (var notification in notifications)
        {
            var targetRole = ParseRole(notification.TargetRole);

            if (targetRole == UserRole.Admin)
            {
                // Admin role uses condominium email, but we don't track this as a user-specific delivery
                // This case would be handled separately if needed, or skipped for user-based tracking
                continue;
            }

            if (!targetRole.HasValue && !notification.TargetUserId.HasValue)
            {
                AddNotificationsForAllUsersExceptManagers(
                    notificationsByUserId,
                    activeUsersById,
                    notification);
                continue;
            }

            if (!notification.TargetUserId.HasValue)
            {
                continue;
            }

            if (!activeUsersById.TryGetValue(notification.TargetUserId.Value, out var targetUser))
            {
                continue;
            }

            if (targetUser.Role != UserRole.Resident)
            {
                continue;
            }

            if (targetRole.HasValue && targetRole != UserRole.Resident)
            {
                continue;
            }

            AddNotificationForUser(notificationsByUserId, targetUser, notification);
        }

        return notificationsByUserId;
    }

    private static UserRole? ParseRole(string? rawRole)
    {
        if (string.IsNullOrWhiteSpace(rawRole))
        {
            return null;
        }

        if (!Enum.TryParse<UserRole>(rawRole, true, out var role))
        {
            return null;
        }

        return role;
    }

    private static void AddNotificationForUser(
        Dictionary<Guid, List<Notification>> notificationsByUserId,
        User user,
        Notification notification)
    {
        if (!notificationsByUserId.TryGetValue(user.Id, out var userNotifications))
        {
            userNotifications = new List<Notification>();
            notificationsByUserId[user.Id] = userNotifications;
        }

        userNotifications.Add(notification);
    }

    private void AddNotificationsForAllUsersExceptManagers(
        Dictionary<Guid, List<Notification>> notificationsByUserId,
        IReadOnlyDictionary<Guid, User> activeUsersById,
        Notification notification)
    {
        foreach (var user in activeUsersById.Values)
        {
            if (user.Role == UserRole.Manager)
            {
                continue;
            }

            AddNotificationForUser(notificationsByUserId, user, notification);
        }
    }

    private string? GetCondominiumEmail(Condominium? condominium)
    {
        if (condominium == null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(condominium.EmailEncrypted))
        {
            return _encryptionService.Decrypt(condominium.EmailEncrypted);
        }

        return null;
    }

    private string GetUserEmail(User user)
    {
        return string.IsNullOrWhiteSpace(user.EmailEncrypted)
            ? string.Empty
            : _encryptionService.Decrypt(user.EmailEncrypted);
    }

    private static string BuildDispatchKeyPrefix(Guid condominiumId, List<Notification> notifications)
    {
        var signature = string.Join("|", notifications.OrderBy(n => n.Id).Select(n => n.Id));
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(signature));
        var hash = Convert.ToHexString(bytes);
        return $"{condominiumId}:{hash}";
    }

    private static string BuildEmailBody(List<Notification> notifications)
    {
        if (notifications.Count == 1)
        {
            var n = notifications[0];
            return $"{n.Title}\n\n{n.Message}";
        }

        var sb = new StringBuilder();
        sb.AppendLine("Tem novas notificacoes na plataforma Habitus:");
        sb.AppendLine();

        foreach (var n in notifications.Take(10))
        {
            sb.AppendLine($"- {n.Title}: {n.Message}");
        }

        if (notifications.Count > 10)
        {
            sb.AppendLine($"... e mais {notifications.Count - 10} notificacoes.");
        }

        return sb.ToString();
    }

    private static string BuildWhatsAppBody(List<Notification> notifications)
    {
        if (notifications.Count == 1)
        {
            var n = notifications[0];
            return $"{n.Title}\n{n.Message}";
        }

        var titles = string.Join("\n", notifications.Take(5).Select(n => $"- {n.Title}"));
        var remaining = notifications.Count > 5 ? $"\n... e mais {notifications.Count - 5}." : string.Empty;

        return $"Foram geradas {notifications.Count} novas notificacoes:\n{titles}{remaining}";
    }

    private static string ComputeEmailHash(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return string.Empty;

        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(email.ToLowerInvariant().Trim()));
        return Convert.ToHexString(bytes);
    }
}

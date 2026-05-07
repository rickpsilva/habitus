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

    public NotificationDispatchService(
        IRepository<User> userRepository,
        IRepository<Condominium> condominiumRepository,
        IRepository<CommunicationSettings> settingsRepository,
        IRepository<NotificationDispatchDelivery> dispatchDeliveryRepository,
        IEmailService emailService,
        IWhatsAppService whatsAppService)
    {
        _userRepository = userRepository;
        _condominiumRepository = condominiumRepository;
        _settingsRepository = settingsRepository;
        _dispatchDeliveryRepository = dispatchDeliveryRepository;
        _emailService = emailService;
        _whatsAppService = whatsAppService;
    }

    public async Task DispatchAsync(IEnumerable<Notification> notifications, bool sendExternalChannels = true)
    {
        var batch = notifications?.ToList() ?? new List<Notification>();
        if (batch.Count == 0 || !sendExternalChannels) return;

        var condominiumId = batch[0].CondominiumId;
        if (batch.Any(n => n.CondominiumId != condominiumId))
            throw new InvalidOperationException("All notifications in a dispatch batch must belong to the same condominium.");

        var settings = (await _settingsRepository.FindAsync(s => s.CondominiumId == condominiumId)).FirstOrDefault();
        if (settings == null) return;

        var dispatchKeyPrefix = BuildDispatchKeyPrefix(condominiumId, batch);

        var recipients = await ResolveRecipientsAsync(batch, condominiumId);
        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);

        if (settings.EmailEnabled)
        {
            var recipientEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var user in recipients.Where(u => !string.IsNullOrWhiteSpace(u.Email)))
            {
                recipientEmails.Add(user.Email!.Trim().ToLowerInvariant());
            }

            if (!string.IsNullOrWhiteSpace(condominium?.Email))
            {
                recipientEmails.Add(condominium.Email.Trim().ToLowerInvariant());
            }

            foreach (var email in recipientEmails)
            {
                var delivery = await TryReserveDeliveryAsync(condominiumId, "email", dispatchKeyPrefix, email);
                if (delivery == null) continue;

                var subject = batch.Count == 1 ? batch[0].Title : $"{batch.Count} novas notificacoes";
                var body = BuildEmailBody(batch);

                try
                {
                    await _emailService.SendAsync(email, subject, body);
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
            var delivery = await TryReserveDeliveryAsync(condominiumId, "whatsapp", dispatchKeyPrefix, groupId);
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

    private async Task<NotificationDispatchDelivery?> TryReserveDeliveryAsync(Guid condominiumId, string channel, string dispatchKey, string recipient)
    {
        var now = DateTime.UtcNow;

        var existing = (await _dispatchDeliveryRepository.FindAsync(d =>
            d.Channel == channel &&
            d.DispatchKey == dispatchKey &&
            d.Recipient == recipient)).FirstOrDefault();

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
            Recipient = recipient,
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

    private async Task<List<User>> ResolveRecipientsAsync(List<Notification> notifications, Guid condominiumId)
    {
        var users = (await _userRepository.FindAsync(u => u.CondominiumId == condominiumId && u.IsActive)).ToList();
        var targetUserIds = new HashSet<Guid>();

        foreach (var notification in notifications)
        {
            if (notification.TargetUserId.HasValue)
            {
                targetUserIds.Add(notification.TargetUserId.Value);
                continue;
            }

            if (string.IsNullOrWhiteSpace(notification.TargetRole))
            {
                foreach (var user in users)
                {
                    targetUserIds.Add(user.Id);
                }

                continue;
            }

            if (Enum.TryParse<UserRole>(notification.TargetRole, out var role))
            {
                foreach (var user in users.Where(u => u.Role == role))
                {
                    targetUserIds.Add(user.Id);
                }
            }
        }

        return users.Where(u => targetUserIds.Contains(u.Id)).ToList();
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
}

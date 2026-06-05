using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Net.Mail;

namespace Habitus.Infrastructure.Services;

public class SmtpCommunicationEmailService : IEmailService
{
    private readonly IRepository<SystemEmailSettings> _systemEmailSettingsRepository;
    private readonly IRepository<CommunicationSettings> _communicationSettingsRepository;
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<SmtpCommunicationEmailService> _logger;

    public SmtpCommunicationEmailService(
        IRepository<SystemEmailSettings> systemEmailSettingsRepository,
        IRepository<CommunicationSettings> communicationSettingsRepository,
        IEncryptionService encryptionService,
        ILogger<SmtpCommunicationEmailService> logger)
    {
        _systemEmailSettingsRepository = systemEmailSettingsRepository;
        _communicationSettingsRepository = communicationSettingsRepository;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    public async Task SendAsync(
        string to,
        string subject,
        string body,
        EmailSenderType senderType = EmailSenderType.System,
        Guid? condominiumId = null)
    {
        if (string.IsNullOrWhiteSpace(to))
            throw new ArgumentException("Destination email is required.", nameof(to));

        var configuration = senderType == EmailSenderType.Condominium
            ? await GetCondominiumSmtpConfigurationAsync(condominiumId)
            : await GetSystemSmtpConfigurationAsync();

        using var message = new MailMessage
        {
            From = new MailAddress(configuration.Username ?? string.Empty, string.Empty),
            Subject = subject,
            Body = body,
            IsBodyHtml = LooksLikeHtml(body)
        };
        message.To.Add(to.Trim());

        using var client = new SmtpClient(configuration.Host, configuration.Port)
        {
            EnableSsl = configuration.UseSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false
        };

        if (!string.IsNullOrWhiteSpace(configuration.Username))
        {
            client.Credentials = new NetworkCredential(configuration.Username, configuration.Password ?? string.Empty);
        }

        await client.SendMailAsync(message);
    }

    private async Task<SmtpConfiguration> GetSystemSmtpConfigurationAsync()
    {
        var settings = (await _systemEmailSettingsRepository.GetAllAsync()).FirstOrDefault();

        if (settings == null || !settings.EmailEnabled)
            throw new InvalidOperationException("System SMTP settings are not configured or are disabled.");

        if (string.IsNullOrWhiteSpace(settings.SmtpHost))
            throw new InvalidOperationException("System SMTP host is not configured.");

        if (string.IsNullOrWhiteSpace(settings.FromAddress))
            throw new InvalidOperationException("System sender email is not configured.");

        string? password = null;
        if (!string.IsNullOrWhiteSpace(settings.PasswordEncrypted))
        {
            try
            {
                password = _encryptionService.Decrypt(settings.PasswordEncrypted);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to decrypt system SMTP password.");
                throw new InvalidOperationException("System SMTP password is invalid.");
            }
        }

        return new SmtpConfiguration(
            settings.SmtpHost.Trim(),
            settings.SmtpPort > 0 ? settings.SmtpPort : 587,
            settings.Username?.Trim(),
            password,
            settings.UseSsl);
    }

    private async Task<SmtpConfiguration> GetCondominiumSmtpConfigurationAsync(Guid? condominiumId)
    {
        if (!condominiumId.HasValue)
            throw new InvalidOperationException("CondominiumId is required for condominium SMTP sending.");

        var settings = (await _communicationSettingsRepository
                .FindAsync(s => s.CondominiumId == condominiumId.Value))
            .FirstOrDefault();

        if (settings == null || !settings.EmailEnabled)
            throw new InvalidOperationException("Condominium SMTP settings are not configured or are disabled.");

        if (string.IsNullOrWhiteSpace(settings.EmailSmtpHost))
            throw new InvalidOperationException("Condominium SMTP host is not configured.");

        string? password = settings.EmailPassword;
        if (!string.IsNullOrWhiteSpace(password) && _encryptionService.IsEncrypted(password))
        {
            try
            {
                password = _encryptionService.Decrypt(password);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to decrypt condominium SMTP password for condominium {CondominiumId}.", condominiumId.Value);
                throw new InvalidOperationException("Condominium SMTP password is invalid.");
            }
        }

        string? username = settings.EmailUsernameEncrypted;
        if (!string.IsNullOrWhiteSpace(username) && _encryptionService.IsEncrypted(username))
        {
            try
            {
                username = _encryptionService.Decrypt(username);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to decrypt condominium SMTP username for condominium {CondominiumId}.", condominiumId.Value);
                throw new InvalidOperationException("Condominium SMTP username is invalid.");
            }
        }

        var smtpPort = settings.EmailSmtpPort.GetValueOrDefault(587);
        if (smtpPort <= 0)
        {
            smtpPort = 587;
        }

        return new SmtpConfiguration(
            settings.EmailSmtpHost.Trim(),
            smtpPort,
            username?.Trim(),
            password,
            settings.EmailUseSsl);
    }

    private static bool LooksLikeHtml(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return false;

        return body.Contains("<html", StringComparison.OrdinalIgnoreCase)
            || body.Contains("<body", StringComparison.OrdinalIgnoreCase)
            || body.Contains("<table", StringComparison.OrdinalIgnoreCase)
            || body.Contains("</", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record SmtpConfiguration(
        string Host,
        int Port,
        string? Username,
        string? Password,
        bool UseSsl);
}

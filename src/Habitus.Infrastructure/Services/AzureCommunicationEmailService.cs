using Azure.Communication.Email;
using Habitus.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Habitus.Infrastructure.Services;

public class AzureCommunicationEmailService : IEmailService
{
    private readonly EmailClient _client;
    private readonly string _senderEmail;

    public AzureCommunicationEmailService(IConfiguration configuration)
    {
        var connectionString = configuration["AzureCommunication:ConnectionString"]
            ?? throw new InvalidOperationException("AzureCommunication:ConnectionString is not configured.");
        _client = new EmailClient(connectionString);
        _senderEmail = configuration["AzureCommunication:SenderEmail"] ?? "noreply@habitus.com";
    }

    public async Task SendAsync(
        string to,
        string subject,
        string body,
        EmailSenderType senderType = EmailSenderType.System,
        Guid? condominiumId = null)
    {
        var message = new EmailMessage(
            senderAddress: _senderEmail,
            recipients: new EmailRecipients(new[] { new EmailAddress(to) }),
            content: new EmailContent(subject) { PlainText = body });
        await _client.SendAsync(Azure.WaitUntil.Completed, message);
    }
}

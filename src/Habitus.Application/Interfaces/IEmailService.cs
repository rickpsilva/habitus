namespace Habitus.Application.Interfaces;

public interface IEmailService
{
    Task SendAsync(
        string to,
        string subject,
        string body,
        EmailSenderType senderType = EmailSenderType.System,
        Guid? condominiumId = null);
}

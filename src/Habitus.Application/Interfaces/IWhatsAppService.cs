namespace Habitus.Application.Interfaces;

public interface IWhatsAppService
{
    Task SendGroupMessageAsync(string groupId, string message);
}

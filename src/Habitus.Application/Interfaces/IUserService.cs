using Habitus.Application.DTOs.Users;

namespace Habitus.Application.Interfaces;

public interface IUserService
{
    Task<bool> HasGdprConsentAsync(string userId);
    Task<GdprConsentStatusResponse> SaveGdprConsentAsync(Guid userId, string ipAddress, SaveGdprConsentRequest request);
    Task<GdprConsentStatusResponse> GetGdprConsentStatusAsync(Guid userId);
}

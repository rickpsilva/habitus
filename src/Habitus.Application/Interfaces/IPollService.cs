using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Polls;

namespace Habitus.Application.Interfaces;

public interface IPollService
{
    Task<PollDto> CreateAsync(Guid condominiumId, Guid creatorId, CreatePollRequest request, CancellationToken ct = default);
    Task<PaginatedResponse<PollDto>> GetPagedAsync(Guid condominiumId, Guid userId, int page, int pageSize, string? status, CancellationToken ct = default);
    Task<PollDto> GetByIdAsync(Guid condominiumId, Guid pollId, Guid userId, CancellationToken ct = default);
    Task<PollDto> CastVoteAsync(Guid condominiumId, Guid pollId, Guid userId, CastVoteRequest request, CancellationToken ct = default);
    Task CloseAsync(Guid condominiumId, Guid pollId, Guid adminId, CancellationToken ct = default);
}

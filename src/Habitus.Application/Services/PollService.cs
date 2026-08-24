using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Polls;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Habitus.Application.Services;

public class PollService : IPollService
{
    private readonly IRepository<Poll> _pollRepository;
    private readonly IRepository<PollVote> _voteRepository;
    private readonly IRepository<Announcement> _announcementRepository;
    private readonly IRepository<User> _userRepository;

    public PollService(
        IRepository<Poll> pollRepository,
        IRepository<PollVote> voteRepository,
        IRepository<Announcement> announcementRepository,
        IRepository<User> userRepository)
    {
        _pollRepository = pollRepository;
        _voteRepository = voteRepository;
        _announcementRepository = announcementRepository;
        _userRepository = userRepository;
    }

    public async Task<PollDto> CreateAsync(Guid condominiumId, Guid creatorId, CreatePollRequest request, CancellationToken ct = default)
    {
        ValidateCreateRequest(request);

        await EnsureAdminAsync(creatorId);

        if (request.AnnouncementId.HasValue)
        {
            var announcement = await _announcementRepository.GetByIdAsync(request.AnnouncementId.Value);
            if (announcement == null || announcement.CondominiumId != condominiumId)
                throw new KeyNotFoundException("Announcement not found");
        }

        var poll = new Poll
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            AnnouncementId = request.AnnouncementId,
            Title = request.Title.Trim(),
            Description = request.Description,
            ExpiresAtUtc = request.ExpiresAtUtc,
            Status = PollStatus.Active,
            CreatedByUserId = creatorId,
            CreatedAtUtc = DateTime.UtcNow,
            Options = request.Options
                .Select((option, index) => new PollOption
                {
                    Id = Guid.NewGuid(),
                    Text = option.Text.Trim(),
                    DisplayOrder = index
                })
                .ToList()
        };

        await _pollRepository.AddAsync(poll);
        await _pollRepository.SaveChangesAsync(ct);

        return MapToDto(poll, myVoteOptionId: null);
    }

    public async Task<PaginatedResponse<PollDto>> GetPagedAsync(Guid condominiumId, Guid userId, int page, int pageSize, string? status, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        Expression<Func<Poll, bool>> filter = p => p.CondominiumId == condominiumId;

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<PollStatus>(status, out var statusEnum))
        {
            filter = filter.And(p => p.Status == statusEnum);
        }

        var result = await _pollRepository.GetPagedWithIncludesAsync(
            page,
            pageSize,
            filter,
            p => p.CreatedAtUtc,
            true, // newest first
            nameof(Poll.Options),
            "Options.Votes");

        return new PaginatedResponse<PollDto>
        {
            Items = result.Items.Select(p => MapToDto(p, GetMyVoteOptionId(p, userId))).ToList(),
            Page = result.Page,
            PageSize = result.PageSize,
            TotalItems = result.TotalItems,
            TotalPages = result.TotalPages
        };
    }

    public async Task<PollDto> GetByIdAsync(Guid condominiumId, Guid pollId, Guid userId, CancellationToken ct = default)
    {
        var poll = await _pollRepository.GetByIdWithIncludesAsync(pollId, nameof(Poll.Options), "Options.Votes");

        if (poll == null || poll.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Poll not found");

        return MapToDto(poll, GetMyVoteOptionId(poll, userId));
    }

    public async Task<PollDto> CastVoteAsync(Guid condominiumId, Guid pollId, Guid userId, CastVoteRequest request, CancellationToken ct = default)
    {
        var poll = await _pollRepository.GetByIdWithIncludesAsync(pollId, nameof(Poll.Options));

        if (poll == null || poll.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Poll not found");

        if (poll.Status != PollStatus.Active)
            throw new InvalidOperationException("This poll is closed");

        if (poll.ExpiresAtUtc <= DateTime.UtcNow)
            throw new InvalidOperationException("This poll has expired");

        var option = poll.Options.FirstOrDefault(o => o.Id == request.PollOptionId);
        if (option == null)
            throw new ArgumentException("The selected option does not belong to this poll");

        var existingVote = await _voteRepository.FirstOrDefaultAsync(
            v => v.PollId == pollId && v.VotedByUserId == userId, ct);
        if (existingVote != null)
            throw new InvalidOperationException("You have already voted in this poll");

        var vote = new PollVote
        {
            Id = Guid.NewGuid(),
            PollId = pollId,
            PollOptionId = option.Id,
            VotedByUserId = userId,
            VotedAtUtc = DateTime.UtcNow
        };

        try
        {
            await _voteRepository.AddAsync(vote);
            await _voteRepository.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Unique index IX_PollVotes_PollId_VotedByUserId rejected a concurrent duplicate vote
            throw new InvalidOperationException("You have already voted in this poll");
        }

        return await GetByIdAsync(condominiumId, pollId, userId, ct);
    }

    public async Task CloseAsync(Guid condominiumId, Guid pollId, Guid adminId, CancellationToken ct = default)
    {
        var poll = await _pollRepository.GetByIdWithIncludesAsync(pollId, nameof(Poll.Options), "Options.Votes");

        if (poll == null || poll.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Poll not found");

        await EnsureAdminAsync(adminId);

        poll.Status = PollStatus.Closed;
        _pollRepository.Update(poll);
        await _pollRepository.SaveChangesAsync(ct);
    }

    private async Task EnsureAdminAsync(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null || user.Role != UserRole.Admin)
            throw new UnauthorizedAccessException("Only condominium administrators can perform this action");
    }

    private static void ValidateCreateRequest(CreatePollRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ArgumentException("Title is required");
        if (request.Title.Length > 200)
            throw new ArgumentException("Title cannot exceed 200 characters");
        if (string.IsNullOrWhiteSpace(request.Description))
            throw new ArgumentException("Description is required");
        if (request.ExpiresAtUtc <= DateTime.UtcNow)
            throw new ArgumentException("Expiration date must be in the future");
        if (request.Options == null || request.Options.Count < 2)
            throw new ArgumentException("A poll must have at least two options");
        if (request.Options.Any(o => string.IsNullOrWhiteSpace(o.Text))
            || request.Options.Select(o => o.Text.Trim()).Distinct().Count() != request.Options.Count)
            throw new ArgumentException("Poll options must be non-empty and distinct");
    }

    private static Guid? GetMyVoteOptionId(Poll poll, Guid userId) =>
        poll.Options
            .Where(o => o.Votes.Any(v => v.VotedByUserId == userId))
            .Select(o => (Guid?)o.Id)
            .FirstOrDefault();

    private static PollDto MapToDto(Poll poll, Guid? myVoteOptionId)
    {
        var totalVotes = poll.Options.Sum(o => o.Votes.Count);

        return new PollDto
        {
            Id = poll.Id,
            Title = poll.Title,
            Description = poll.Description,
            AnnouncementId = poll.AnnouncementId,
            ExpiresAtUtc = poll.ExpiresAtUtc,
            IsExpired = poll.ExpiresAtUtc <= DateTime.UtcNow,
            Status = poll.Status.ToString(),
            CreatedAtUtc = poll.CreatedAtUtc,
            MyVoteOptionId = myVoteOptionId,
            TotalVotes = totalVotes,
            Options = poll.Options
                .OrderBy(o => o.DisplayOrder)
                .Select(o => new PollOptionDto
                {
                    Id = o.Id,
                    Text = o.Text,
                    DisplayOrder = o.DisplayOrder,
                    VoteCount = o.Votes.Count,
                    Percentage = totalVotes == 0 ? 0m : Math.Round(o.Votes.Count * 100m / totalVotes, 1)
                })
                .ToList()
        };
    }
}

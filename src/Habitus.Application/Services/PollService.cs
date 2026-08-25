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
    private readonly IRepository<PollOption> _optionRepository;
    private readonly IRepository<PollVote> _voteRepository;
    private readonly IRepository<Announcement> _announcementRepository;
    private readonly IRepository<User> _userRepository;

    public PollService(
        IRepository<Poll> pollRepository,
        IRepository<PollOption> optionRepository,
        IRepository<PollVote> voteRepository,
        IRepository<Announcement> announcementRepository,
        IRepository<User> userRepository)
    {
        _pollRepository = pollRepository;
        _optionRepository = optionRepository;
        _voteRepository = voteRepository;
        _announcementRepository = announcementRepository;
        _userRepository = userRepository;
    }

    public async Task<PollDto> CreateAsync(Guid condominiumId, Guid creatorId, CreatePollRequest request, CancellationToken ct = default)
    {
        if (!request.AnnouncementId.HasValue)
            throw new ArgumentException("A poll must be linked to an announcement");

        await EnsureCanManagePollsAsync(condominiumId, request.AnnouncementId.Value, creatorId);

        ValidateTitle(request.Title);
        ValidateDescription(request.Description);
        ValidateClosingDate(request.ClosesAtUtc);
        ValidateOptions(request.Options);

        var poll = new Poll
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            AnnouncementId = request.AnnouncementId,
            Title = request.Title.Trim(),
            Description = request.Description,
            ClosesAtUtc = request.ClosesAtUtc,
            Status = PollStatus.Active,
            CreatedByUserId = creatorId,
            CreatedAtUtc = DateTime.UtcNow,
            Options = CreateOptions(request.Options)
        };

        await _pollRepository.AddAsync(poll);
        await _pollRepository.SaveChangesAsync(ct);

        return MapToDto(poll, myVoteOptionId: null);
    }

    public async Task<PollDto> UpdateAsync(Guid condominiumId, Guid pollId, Guid userId, UpdatePollRequest request, CancellationToken ct = default)
    {
        var poll = await GetOwnedPollOrThrowAsync(condominiumId, pollId);
        await EnsureCanManagePollsAsync(condominiumId, RequireAnnouncementId(poll), userId);

        // Only provided fields are applied; provided fields must still be valid.
        if (request.Title != null)
            ValidateTitle(request.Title);
        if (request.Description != null)
            ValidateDescription(request.Description);
        if (request.ClosesAtUtc.HasValue)
            ValidateClosingDate(request.ClosesAtUtc.Value);
        if (request.Options != null)
            ValidateOptions(request.Options);

        if (!string.IsNullOrWhiteSpace(request.Title))
            poll.Title = request.Title.Trim();
        if (!string.IsNullOrWhiteSpace(request.Description))
            poll.Description = request.Description;
        if (request.ClosesAtUtc.HasValue)
            poll.ClosesAtUtc = request.ClosesAtUtc.Value;

        if (request.Options != null)
        {
            // Wholesale replacement: drop the existing options and insert the new set.
            foreach (var existingOption in poll.Options.ToList())
                _optionRepository.Remove(existingOption);
            poll.Options = CreateOptions(request.Options, poll.Id);
        }

        _pollRepository.Update(poll);
        await _pollRepository.SaveChangesAsync(ct);

        return MapToDto(poll, GetMyVoteOptionId(poll, userId));
    }

    public async Task DeleteAsync(Guid condominiumId, Guid pollId, Guid userId, CancellationToken ct = default)
    {
        var poll = await GetOwnedPollOrThrowAsync(condominiumId, pollId);
        await EnsureCanManagePollsAsync(condominiumId, RequireAnnouncementId(poll), userId);

        _pollRepository.Remove(poll); // cascades to options and votes
        await _pollRepository.SaveChangesAsync(ct);
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

        if (poll.ClosesAtUtc <= DateTime.UtcNow)
            throw new InvalidOperationException("Voting for this poll is closed");

        // Voting is only possible while the linked announcement remains published.
        var announcement = poll.AnnouncementId.HasValue
            ? await _announcementRepository.GetByIdAsync(poll.AnnouncementId.Value)
            : null;
        if (announcement?.Status != AnnouncementStatus.Published)
            throw new InvalidOperationException("This poll is not open for voting");

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

    /// <summary>
    /// Loads the linked announcement and enforces the poll-management rules shared by
    /// create/update/delete: the announcement must exist in the condominium, must not be
    /// published/archived, and the caller must be its author or a condominium administrator.
    /// </summary>
    private async Task EnsureCanManagePollsAsync(Guid condominiumId, Guid announcementId, Guid userId)
    {
        var announcement = await _announcementRepository.GetByIdAsync(announcementId);
        if (announcement == null || announcement.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Announcement not found");

        var isUnpublished = announcement.Status
            is AnnouncementStatus.Draft
            or AnnouncementStatus.PendingApproval
            or AnnouncementStatus.Rejected;
        if (!isUnpublished)
            throw new InvalidOperationException("Polls can only be managed while the linked announcement is not published or archived");

        if (announcement.AuthorId == userId)
            return;

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null || user.Role != UserRole.Admin)
            throw new UnauthorizedAccessException("Only the announcement author or a condominium administrator can manage polls");
    }

    private async Task<Poll> GetOwnedPollOrThrowAsync(Guid condominiumId, Guid pollId)
    {
        var poll = await _pollRepository.GetByIdWithIncludesAsync(pollId, nameof(Poll.Options));
        if (poll == null || poll.CondominiumId != condominiumId)
            throw new KeyNotFoundException("Poll not found");
        return poll;
    }

    private static Guid RequireAnnouncementId(Poll poll) =>
        poll.AnnouncementId ?? throw new KeyNotFoundException("Announcement not found");

    private static List<PollOption> CreateOptions(List<CreatePollOptionRequest> options, Guid? pollId = null) =>
        options
            .Select((option, index) => new PollOption
            {
                Id = Guid.NewGuid(),
                PollId = pollId ?? Guid.Empty,
                Text = option.Text.Trim(),
                DisplayOrder = index
            })
            .ToList();

    private static void ValidateTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required");
        if (title.Length > 200)
            throw new ArgumentException("Title cannot exceed 200 characters");
    }

    private static void ValidateDescription(string description)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required");
    }

    private static void ValidateClosingDate(DateTime closesAtUtc)
    {
        if (closesAtUtc <= DateTime.UtcNow)
            throw new ArgumentException("Closing date must be in the future");
    }

    private static void ValidateOptions(List<CreatePollOptionRequest> options)
    {
        if (options == null || options.Count < 2)
            throw new ArgumentException("A poll must have at least two options");
        if (options.Any(o => string.IsNullOrWhiteSpace(o.Text))
            || options.Select(o => o.Text.Trim()).Distinct().Count() != options.Count)
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
            ClosesAtUtc = poll.ClosesAtUtc,
            IsClosed = poll.ClosesAtUtc <= DateTime.UtcNow,
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

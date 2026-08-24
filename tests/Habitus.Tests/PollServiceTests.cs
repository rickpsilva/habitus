using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Polls;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class PollServiceTests
{
    private readonly Mock<IRepository<Poll>> _pollRepoMock;
    private readonly Mock<IRepository<PollVote>> _voteRepoMock;
    private readonly Mock<IRepository<Announcement>> _announcementRepoMock;
    private readonly Mock<IRepository<User>> _userRepoMock;
    private readonly PollService _service;
    private Expression<Func<Poll, bool>>? _pagedFilter;

    private readonly Guid _condominiumId = Guid.NewGuid();
    private readonly Guid _adminId = Guid.NewGuid();
    private readonly Guid _announcementId = Guid.NewGuid();

    public PollServiceTests()
    {
        _pollRepoMock = new Mock<IRepository<Poll>>();
        _voteRepoMock = new Mock<IRepository<PollVote>>();
        _announcementRepoMock = new Mock<IRepository<Announcement>>();
        _userRepoMock = new Mock<IRepository<User>>();

        _pollRepoMock.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _voteRepoMock.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _pollRepoMock.Setup(r => r.AddAsync(It.IsAny<Poll>())).Returns(Task.CompletedTask);
        _voteRepoMock.Setup(r => r.AddAsync(It.IsAny<PollVote>())).Returns(Task.CompletedTask);

        // Default: the linked announcement exists and belongs to the same condominium.
        _announcementRepoMock.Setup(r => r.GetByIdAsync(_announcementId))
            .ReturnsAsync(new Announcement { Id = _announcementId, CondominiumId = _condominiumId });

        _service = new PollService(
            _pollRepoMock.Object,
            _voteRepoMock.Object,
            _announcementRepoMock.Object,
            _userRepoMock.Object);
    }

    private static CreatePollRequest ValidRequest(Guid? announcementId = null, DateTime? expiresAtUtc = null) => new()
    {
        Title = "Novo ginásio",
        Description = "Concorda com a criação do ginásio?",
        AnnouncementId = announcementId,
        ExpiresAtUtc = expiresAtUtc ?? DateTime.UtcNow.AddDays(7),
        Options =
        [
            new CreatePollOptionRequest { Text = "Sim" },
            new CreatePollOptionRequest { Text = "Não" }
        ]
    };

    private void SetupAdmin(Guid userId) =>
        _userRepoMock.Setup(r => r.GetByIdAsync(userId))
            .ReturnsAsync(new User { Id = userId, Role = UserRole.Admin, CondominiumId = _condominiumId });

    private void SetupPollFetch(Poll poll)
    {
        _pollRepoMock.Setup(r => r.GetByIdWithIncludesAsync(poll.Id, nameof(Poll.Options))).ReturnsAsync(poll);
        _pollRepoMock.Setup(r => r.GetByIdWithIncludesAsync(poll.Id, nameof(Poll.Options), "Options.Votes")).ReturnsAsync(poll);
    }

    private static Poll BuildPoll(
        Guid? condominiumId = null,
        PollStatus status = PollStatus.Active,
        DateTime? expiresAtUtc = null,
        int optionCount = 2,
        List<PollVote>? votes = null)
    {
        var condoId = condominiumId ?? Guid.NewGuid();
        var pollId = Guid.NewGuid();
        var poll = new Poll
        {
            Id = pollId,
            CondominiumId = condoId,
            Title = "Novo ginásio",
            Description = "Concorda?",
            ExpiresAtUtc = expiresAtUtc ?? DateTime.UtcNow.AddDays(7),
            Status = status,
            CreatedByUserId = Guid.NewGuid(),
            CreatedAtUtc = DateTime.UtcNow
        };
        for (var i = 0; i < optionCount; i++)
        {
            var option = new PollOption { Id = Guid.NewGuid(), PollId = pollId, Text = $"Opção {i + 1}", DisplayOrder = i };
            if (votes != null)
            {
                foreach (var vote in votes.Where(v => v.PollOptionId == option.Id))
                {
                    vote.PollId = pollId;
                    option.Votes.Add(vote);
                }
            }
            poll.Options.Add(option);
        }
        return poll;
    }

    // ── CreateAsync ───────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WhenNoAnnouncementLinked_Throws()
    {
        // Arrange
        SetupAdmin(_adminId);
        var request = ValidRequest(announcementId: null);

        // Act
        var act = () => _service.CreateAsync(_condominiumId, _adminId, request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*announcement*");
        _pollRepoMock.Verify(r => r.AddAsync(It.IsAny<Poll>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WhenExpiresInPast_Throws()
    {
        // Arrange
        SetupAdmin(_adminId);
        var request = ValidRequest(announcementId: _announcementId, expiresAtUtc: DateTime.UtcNow.AddDays(-1));

        // Act
        var act = () => _service.CreateAsync(_condominiumId, _adminId, request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>();
        _pollRepoMock.Verify(r => r.AddAsync(It.IsAny<Poll>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WithLessThanTwoDistinctOptions_Throws()
    {
        // Arrange
        SetupAdmin(_adminId);
        var request = ValidRequest(announcementId: _announcementId);
        request.Options[1].Text = request.Options[0].Text; // duplicate text

        // Act
        var act = () => _service.CreateAsync(_condominiumId, _adminId, request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task CreateAsync_WhenAnnouncementFromOtherCondo_Throws()
    {
        // Arrange
        SetupAdmin(_adminId);
        var announcementId = Guid.NewGuid();
        var request = ValidRequest(announcementId: announcementId);
        _announcementRepoMock.Setup(r => r.GetByIdAsync(announcementId))
            .ReturnsAsync(new Announcement { Id = announcementId, CondominiumId = Guid.NewGuid() }); // other condo

        // Act
        var act = () => _service.CreateAsync(_condominiumId, _adminId, request);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>();
        _pollRepoMock.Verify(r => r.AddAsync(It.IsAny<Poll>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WhenNotAdmin_ThrowsUnauthorized()
    {
        // Arrange
        _userRepoMock.Setup(r => r.GetByIdAsync(_adminId))
            .ReturnsAsync(new User { Id = _adminId, Role = UserRole.Resident });

        // Act
        var act = () => _service.CreateAsync(_condominiumId, _adminId, ValidRequest(announcementId: _announcementId));

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
        _pollRepoMock.Verify(r => r.AddAsync(It.IsAny<Poll>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WhenValid_CreatesPollWithOptions()
    {
        // Arrange
        SetupAdmin(_adminId);
        var request = ValidRequest(announcementId: _announcementId);

        // Act
        var dto = await _service.CreateAsync(_condominiumId, _adminId, request);

        // Assert
        dto.Should().NotBeNull();
        dto.Status.Should().Be("Active");
        dto.IsExpired.Should().BeFalse();
        dto.AnnouncementId.Should().Be(_announcementId);
        dto.Options.Should().HaveCount(2);
        dto.Options[0].Text.Should().Be("Sim");
        dto.Options[1].DisplayOrder.Should().Be(1);
        dto.TotalVotes.Should().Be(0);
        _pollRepoMock.Verify(r => r.AddAsync(It.IsAny<Poll>()), Times.Once);
        _pollRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_WhenTitleExceeds200Chars_Throws()
    {
        // Arrange
        var request = ValidRequest();
        request.Title = new string('x', 201);

        // Act
        var act = () => _service.CreateAsync(_condominiumId, _adminId, request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*200*");
        _pollRepoMock.Verify(r => r.AddAsync(It.IsAny<Poll>()), Times.Never);
    }

    // ── CastVoteAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task CastVoteAsync_WhenFirstVote_RecordsVote()
    {
        // Arrange
        var poll = BuildPoll(condominiumId: _condominiumId);
        SetupPollFetch(poll);
        _voteRepoMock.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<PollVote, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((PollVote?)null);

        // Act
        var dto = await _service.CastVoteAsync(_condominiumId, poll.Id, Guid.NewGuid(),
            new CastVoteRequest { PollOptionId = poll.Options.First().Id });

        // Assert
        dto.Should().NotBeNull();
        _voteRepoMock.Verify(r => r.AddAsync(It.Is<PollVote>(v => v.PollId == poll.Id && v.PollOptionId == poll.Options.First().Id)), Times.Once);
    }

    [Fact]
    public async Task CastVoteAsync_WhenAlreadyVoted_ThrowsConflict()
    {
        // Arrange
        var voterId = Guid.NewGuid();
        var optionId = Guid.NewGuid();
        var poll = BuildPoll(condominiumId: _condominiumId, votes:
        [
            new PollVote { Id = Guid.NewGuid(), PollId = Guid.NewGuid(), PollOptionId = optionId, VotedByUserId = voterId }
        ]);
        SetupPollFetch(poll);
        _voteRepoMock.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<PollVote, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PollVote { Id = Guid.NewGuid(), PollId = poll.Id, PollOptionId = optionId, VotedByUserId = voterId });

        // Act
        var act = () => _service.CastVoteAsync(_condominiumId, poll.Id, voterId,
            new CastVoteRequest { PollOptionId = poll.Options.First().Id });

        // Assert
        var exception = await act.Should().ThrowAsync<InvalidOperationException>();
        exception.Which.Message.Should().Contain("already voted");
    }

    [Fact]
    public async Task CastVoteAsync_WhenPollExpired_Throws()
    {
        // Arrange
        var poll = BuildPoll(condominiumId: _condominiumId, expiresAtUtc: DateTime.UtcNow.AddMinutes(-5));
        SetupPollFetch(poll);

        // Act
        var act = () => _service.CastVoteAsync(_condominiumId, poll.Id, Guid.NewGuid(),
            new CastVoteRequest { PollOptionId = poll.Options.First().Id });

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*expired*");
        _voteRepoMock.Verify(r => r.AddAsync(It.IsAny<PollVote>()), Times.Never);
    }

    [Fact]
    public async Task CastVoteAsync_WhenOptionNotInPoll_Throws()
    {
        // Arrange
        var poll = BuildPoll(condominiumId: _condominiumId);
        SetupPollFetch(poll);

        // Act
        var act = () => _service.CastVoteAsync(_condominiumId, poll.Id, Guid.NewGuid(),
            new CastVoteRequest { PollOptionId = Guid.NewGuid() }); // foreign option

        // Assert
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task CastVoteAsync_WhenPollClosed_ThrowsConflict()
    {
        // Arrange
        var poll = BuildPoll(condominiumId: _condominiumId, status: PollStatus.Closed);
        SetupPollFetch(poll);

        // Act
        var act = () => _service.CastVoteAsync(_condominiumId, poll.Id, Guid.NewGuid(),
            new CastVoteRequest { PollOptionId = poll.Options.First().Id });

        // Assert
        var exception = await act.Should().ThrowAsync<InvalidOperationException>();
        exception.Which.Message.Should().Contain("closed"); // controller maps this to 409 Conflict
        _voteRepoMock.Verify(r => r.AddAsync(It.IsAny<PollVote>()), Times.Never);
    }

    // ── GetByIdAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_WhenOtherCondominium_ThrowsNotFound()
    {
        // Arrange
        var poll = BuildPoll(condominiumId: Guid.NewGuid()); // different condo
        _pollRepoMock.Setup(r => r.GetByIdWithIncludesAsync(poll.Id, nameof(Poll.Options), "Options.Votes"))
            .ReturnsAsync(poll);

        // Act
        var act = () => _service.GetByIdAsync(_condominiumId, poll.Id, Guid.NewGuid());

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ── CloseAsync ────────────────────────────────────────────────────────

    [Fact]
    public async Task CloseAsync_WhenNotAdmin_ThrowsUnauthorized()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var poll = BuildPoll(condominiumId: _condominiumId);
        _pollRepoMock.Setup(r => r.GetByIdWithIncludesAsync(poll.Id, nameof(Poll.Options), "Options.Votes"))
            .ReturnsAsync(poll);
        _userRepoMock.Setup(r => r.GetByIdAsync(userId))
            .ReturnsAsync(new User { Id = userId, Role = UserRole.Resident });

        // Act
        var act = () => _service.CloseAsync(_condominiumId, poll.Id, userId);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
        poll.Status.Should().Be(PollStatus.Active);
    }

    [Fact]
    public async Task CloseAsync_WhenValidAdmin_ClosesPoll()
    {
        // Arrange
        var poll = BuildPoll(condominiumId: _condominiumId);
        SetupPollFetch(poll);
        SetupAdmin(_adminId);

        // Act
        await _service.CloseAsync(_condominiumId, poll.Id, _adminId);

        // Assert
        poll.Status.Should().Be(PollStatus.Closed);
        _pollRepoMock.Verify(r => r.Update(poll), Times.Once);
        _pollRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ── GetPagedAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetPagedAsync_FiltersByCondominium()
    {
        // Arrange
        Expression<Func<Poll, bool>>? capturedFilter = null;
        var myCondoPolls = new List<Poll> { BuildPoll(condominiumId: _condominiumId) };
        _pollRepoMock
            .Setup(r => r.GetPagedWithIncludesAsync(
                It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<Poll, bool>>>(),
                It.IsAny<Expression<Func<Poll, object>>>(),
                It.IsAny<bool>(), It.IsAny<string[]>()))
            .Callback<int, int, Expression<Func<Poll, bool>>, Expression<Func<Poll, object>>, bool, string[]>(
                (_, _, filter, _, _, _) => capturedFilter = filter)
            .ReturnsAsync(new PaginatedResponse<Poll>
            {
                Items = myCondoPolls,
                Page = 1,
                PageSize = 10,
                TotalItems = 1,
                TotalPages = 1
            });

        // Act
        var result = await _service.GetPagedAsync(_condominiumId, Guid.NewGuid(), 1, 10, null);

        // Assert
        capturedFilter.Should().NotBeNull();
        capturedFilter!.Compile()(myCondoPolls[0]).Should().BeTrue();
        capturedFilter.Compile()(BuildPoll(condominiumId: Guid.NewGuid())).Should().BeFalse(); // other condo excluded
        result.Items.Should().ContainSingle();
        result.Items.First().Title.Should().Be(myCondoPolls[0].Title);
    }

    [Fact]
    public async Task GetPagedAsync_WithValidStatusFilter_AppliesStatusToFilter()
    {
        // Arrange
        SetupPagedCapture();
        var activePoll = BuildPoll(condominiumId: _condominiumId);
        var closedPoll = BuildPoll(condominiumId: _condominiumId, status: PollStatus.Closed);

        // Act
        await _service.GetPagedAsync(_condominiumId, Guid.NewGuid(), 1, 10, "Closed");

        // Assert
        var capturedFilter = _pagedFilter!;
        capturedFilter.Compile()(closedPoll).Should().BeTrue();
        capturedFilter.Compile()(activePoll).Should().BeFalse();
    }

    [Fact]
    public async Task GetPagedAsync_WithInvalidStatusFilter_IgnoresStatus()
    {
        // Arrange
        SetupPagedCapture();
        var activePoll = BuildPoll(condominiumId: _condominiumId);
        var closedPoll = BuildPoll(condominiumId: _condominiumId, status: PollStatus.Closed);

        // Act — unparseable status must not throw or narrow the filter
        await _service.GetPagedAsync(_condominiumId, Guid.NewGuid(), 1, 10, "NotARealStatus");

        // Assert
        var capturedFilter = _pagedFilter!;
        capturedFilter.Compile()(activePoll).Should().BeTrue();
        capturedFilter.Compile()(closedPoll).Should().BeTrue();
    }

    /// <summary>
    /// Configures the paged repository stub, capturing the filter expression
    /// passed by the service into <see cref="_pagedFilter"/> so tests can
    /// compile and evaluate it directly.
    /// </summary>
    private void SetupPagedCapture()
    {
        _pagedFilter = null;
        _pollRepoMock
            .Setup(r => r.GetPagedWithIncludesAsync(
                It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<Expression<Func<Poll, bool>>>(),
                It.IsAny<Expression<Func<Poll, object>>>(),
                It.IsAny<bool>(), It.IsAny<string[]>()))
            .Callback<int, int, Expression<Func<Poll, bool>>, Expression<Func<Poll, object>>, bool, string[]>(
                (_, _, filter, _, _, _) => _pagedFilter = filter)
            .ReturnsAsync(new PaginatedResponse<Poll> { Page = 1, PageSize = 10 });
    }
}

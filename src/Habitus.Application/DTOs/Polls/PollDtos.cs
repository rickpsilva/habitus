namespace Habitus.Application.DTOs.Polls;

public class PollDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid? AnnouncementId { get; set; }
    public DateTime ClosesAtUtc { get; set; }
    public bool IsClosed { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }

    // Options with live vote counts
    public List<PollOptionDto> Options { get; set; } = new();

    // Current user's perspective
    public Guid? MyVoteOptionId { get; set; }
    public int TotalVotes { get; set; }
}

public class PollOptionDto
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public int VoteCount { get; set; }
    public decimal Percentage { get; set; }
}

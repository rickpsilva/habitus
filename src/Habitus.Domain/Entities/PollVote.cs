namespace Habitus.Domain.Entities;

public class PollVote
{
    public Guid Id { get; set; }
    public Guid PollId { get; set; }
    public Poll Poll { get; set; } = null!;
    public Guid PollOptionId { get; set; }
    public PollOption PollOption { get; set; } = null!;

    // Voter info
    public Guid VotedByUserId { get; set; }
    public User VotedByUser { get; set; } = null!;
    public DateTime VotedAtUtc { get; set; } = DateTime.UtcNow;
}

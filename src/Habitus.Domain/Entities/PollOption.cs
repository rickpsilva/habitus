namespace Habitus.Domain.Entities;

public class PollOption
{
    public Guid Id { get; set; }
    public Guid PollId { get; set; }
    public Poll Poll { get; set; } = null!;
    public string Text { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }

    // Relations
    public ICollection<PollVote> Votes { get; set; } = new List<PollVote>();
}

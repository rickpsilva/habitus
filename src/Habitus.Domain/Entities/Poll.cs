namespace Habitus.Domain.Entities;

public enum PollStatus
{
    Active,            // Aberta a votos
    Closed             // Encerrada pelo admin
}

public class Poll
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;

    // Optional link to the announcement that announced this poll
    public Guid? AnnouncementId { get; set; }
    public Announcement? Announcement { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public PollStatus Status { get; set; } = PollStatus.Active;

    // Creator info
    public Guid CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Relations
    public ICollection<PollOption> Options { get; set; } = new List<PollOption>();
    public ICollection<PollVote> Votes { get; set; } = new List<PollVote>();
}

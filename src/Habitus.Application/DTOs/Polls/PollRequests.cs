namespace Habitus.Application.DTOs.Polls;

public class CreatePollRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid? AnnouncementId { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public List<CreatePollOptionRequest> Options { get; set; } = new();
}

public class CreatePollOptionRequest
{
    public string Text { get; set; } = string.Empty;
}

public class CastVoteRequest
{
    public Guid PollOptionId { get; set; }
}

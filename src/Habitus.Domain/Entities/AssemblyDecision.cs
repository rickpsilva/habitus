namespace Habitus.Domain.Entities;

public class AssemblyDecision
{
    public Guid Id { get; set; }
    public Guid AssemblyId { get; set; }
    public string Description { get; set; } = string.Empty;
    public int Votes { get; set; }
    public DateTime DecidedAt { get; set; } = DateTime.UtcNow;
    public Assembly Assembly { get; set; } = null!;
}

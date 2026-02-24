namespace Habitus.Domain.Entities;

public enum AssemblyStatus { Scheduled, InProgress, Completed, Cancelled }

public class Assembly
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public AssemblyStatus Status { get; set; } = AssemblyStatus.Scheduled;
    public Guid BuildingId { get; set; }
    public Building Building { get; set; } = null!;
    public ICollection<AssemblyAttendance> Attendances { get; set; } = new List<AssemblyAttendance>();
    public ICollection<AssemblyDecision> Decisions { get; set; } = new List<AssemblyDecision>();
}

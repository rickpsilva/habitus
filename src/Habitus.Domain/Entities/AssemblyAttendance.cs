namespace Habitus.Domain.Entities;

public class AssemblyAttendance
{
    public Guid Id { get; set; }
    public Guid AssemblyId { get; set; }
    public Guid ResidentId { get; set; }
    public DateTime ConfirmedAt { get; set; } = DateTime.UtcNow;
    public Assembly Assembly { get; set; } = null!;
}

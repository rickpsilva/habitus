namespace Habitus.Domain.Entities;

public enum AssemblyStatus { Scheduled, InProgress, Completed, Cancelled }

public class Assembly
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public string Location { get; set; } = string.Empty;
    public AssemblyStatus Status { get; set; } = AssemblyStatus.Scheduled;
    public string? Minutes { get; set; } // ATAs - Actas da Assembleia
    public string? Notes { get; set; } // Notas durante assembleia em curso
    public string? CancellationReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;
    public ICollection<AssemblyAttendance> Attendances { get; set; } = new List<AssemblyAttendance>();
    public ICollection<AssemblyDecision> Decisions { get; set; } = new List<AssemblyDecision>();
    public ICollection<Document> Documents { get; set; } = new List<Document>();
}

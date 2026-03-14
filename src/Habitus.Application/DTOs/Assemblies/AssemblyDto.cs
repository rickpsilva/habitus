namespace Habitus.Application.DTOs.Assemblies;

public class AssemblyDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public string Location { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Minutes { get; set; }
    public string? Notes { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid CondominiumId { get; set; }
}

public class CreateAssemblyRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public string Location { get; set; } = string.Empty;
    public Guid CondominiumId { get; set; }
}

public class UpdateAssemblyRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public string? Location { get; set; }
}

public class UpdateMinutesRequest
{
    public string Minutes { get; set; } = string.Empty;
}

public class UpdateNotesRequest
{
    public string Notes { get; set; } = string.Empty;
}

public class CancelAssemblyRequest
{
    public string CancellationReason { get; set; } = string.Empty;
}

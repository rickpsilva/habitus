namespace Habitus.Application.DTOs.Maintenance;

/// <summary>
/// Per-status tallies for the maintenance list, matching the three statuses the UI understands.
/// <see cref="Completed"/> collapses the domain <c>Completed</c> and <c>Closed</c> statuses,
/// mirroring <c>ToDtoStatus</c>.
/// </summary>
public class MaintenanceStatusCountsDto
{
    public int Open { get; set; }
    public int InProgress { get; set; }
    public int Completed { get; set; }
}

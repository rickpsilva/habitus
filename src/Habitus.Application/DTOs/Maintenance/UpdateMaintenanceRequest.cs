namespace Habitus.Application.DTOs.Maintenance;

public class UpdateMaintenanceRequest
{
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public string? Description { get; set; }
}

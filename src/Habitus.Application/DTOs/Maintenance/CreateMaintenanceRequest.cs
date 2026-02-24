namespace Habitus.Application.DTOs.Maintenance;

public class CreateMaintenanceRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Priority { get; set; } = "Medium";
    public Guid UnitId { get; set; }
    public Guid CreatedBy { get; set; }
    public List<string> Photos { get; set; } = new();
    public string Location { get; set; } = string.Empty;
}

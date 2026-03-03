namespace Habitus.Application.DTOs.Maintenance;

public class UpdateMaintenanceStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? SupplierId { get; set; }
    public string? AdminComments { get; set; }
}

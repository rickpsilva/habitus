namespace Habitus.Domain.Entities;

public class Intervention
{
    public Guid Id { get; set; }
    public Guid MaintenanceRequestId { get; set; }
    public Guid SupplierId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string Notes { get; set; } = string.Empty;
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
    public Supplier Supplier { get; set; } = null!;
}

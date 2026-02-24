namespace Habitus.Domain.Entities;

public class MaintenanceConfirmation
{
    public Guid Id { get; set; }
    public Guid MaintenanceRequestId { get; set; }
    public Guid ResidentId { get; set; }
    public DateTime ConfirmedAt { get; set; } = DateTime.UtcNow;
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
}

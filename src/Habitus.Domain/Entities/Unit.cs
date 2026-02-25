namespace Habitus.Domain.Entities;

public enum UnitType { Apartment, Commercial, Parking }

public class Unit
{
    public Guid Id { get; set; }
    public Guid BuildingId { get; set; }
    public string Number { get; set; } = string.Empty;
    public int Floor { get; set; }
    public UnitType Type { get; set; }
    public decimal Permillage { get; set; }
    public Building Building { get; set; } = null!;
    public ICollection<Resident> Residents { get; set; } = new List<Resident>();
    public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = new List<MaintenanceRequest>();
}

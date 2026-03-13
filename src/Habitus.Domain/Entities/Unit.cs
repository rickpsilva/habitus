namespace Habitus.Domain.Entities;

public enum UnitType { Apartment, Commercial, Parking }

public class Unit
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public string Number { get; set; } = string.Empty;
    public int Floor { get; set; }
    public UnitType Type { get; set; }
    public string? ApartmentNumber { get; set; }
    public decimal Permillage { get; set; }
    public decimal MonthlyQuota { get; set; } // Quota mensal base da fração
    public Condominium Condominium { get; set; } = null!;
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = new List<MaintenanceRequest>();
    public ICollection<Document> Documents { get; set; } = new List<Document>();
}

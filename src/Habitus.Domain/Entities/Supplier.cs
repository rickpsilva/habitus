namespace Habitus.Domain.Entities;

public class Supplier
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? EmailEncrypted { get; set; }
    public string? PhoneEncrypted { get; set; }
    public string? AddressEncrypted { get; set; }
    public string Specialty { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;
    public ICollection<Intervention> Interventions { get; set; } = new List<Intervention>();
    public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = new List<MaintenanceRequest>();
}

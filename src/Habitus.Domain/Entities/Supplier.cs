namespace Habitus.Domain.Entities;

public class Supplier
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; } = string.Empty; // Legacy plaintext column (kept for fallback)
    public string? EmailEncrypted { get; set; }
    public string? Phone { get; set; } = string.Empty; // Legacy plaintext column (kept for fallback)
    public string? PhoneEncrypted { get; set; }
    public string? Address { get; set; } = string.Empty; // Legacy plaintext column (kept for fallback)
    public string? AddressEncrypted { get; set; }
    public string Specialty { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;
    public ICollection<Intervention> Interventions { get; set; } = new List<Intervention>();
    public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = new List<MaintenanceRequest>();
}

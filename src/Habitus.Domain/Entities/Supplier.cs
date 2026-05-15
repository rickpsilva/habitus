namespace Habitus.Domain.Entities;

public class Supplier
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Contact { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;  // DEPRECATED: Use EmailEncrypted instead (kept for legacy compatibility)
    public string? EmailEncrypted { get; set; }  // Encrypted email (new field)
    public string Phone { get; set; } = string.Empty;  // DEPRECATED: Use PhoneEncrypted instead (kept for legacy compatibility)
    public string? PhoneEncrypted { get; set; }  // Encrypted phone number (new field)
    public string Address { get; set; } = string.Empty;  // DEPRECATED: Use AddressEncrypted instead (kept for legacy compatibility)
    public string? AddressEncrypted { get; set; }  // Encrypted address (new field)
    public string Specialty { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;
    public ICollection<Intervention> Interventions { get; set; } = new List<Intervention>();
    public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = new List<MaintenanceRequest>();
}

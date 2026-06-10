namespace Habitus.Domain.Entities;

public enum ContactCategory { Emergency, Service, Administrative }

public class UsefulContact
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; } = string.Empty;  // Legacy plaintext column (kept for fallback)
    public string? PhoneEncrypted { get; set; }
    public string? EmailEncrypted { get; set; }
    public string? AddressEncrypted { get; set; }
    public string? PostalCodeEncrypted { get; set; }
    public string? LocalityEncrypted { get; set; }
    public ContactCategory Category { get; set; }
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;
}

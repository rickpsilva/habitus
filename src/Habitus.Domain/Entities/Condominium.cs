namespace Habitus.Domain.Entities;

public class Condominium
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; } = string.Empty;
    public string? AddressEncrypted { get; set; }
    public string? Email { get; set; } = string.Empty;  // Legacy plaintext column (kept for fallback)
    public string? EmailEncrypted { get; set; }
    public string? PostalCodeEncrypted { get; set; }
    public string? LocalityEncrypted { get; set; }
    public string? ContactPhoneEncrypted { get; set; }
    public string? TaxIdEncrypted { get; set; }  // Encrypted NIF or NIPC (new field)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    
    // Navigation properties
    public ICollection<Unit> Units { get; set; } = new List<Unit>();
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Document> Documents { get; set; } = new List<Document>();
    public ICollection<Supplier> Suppliers { get; set; } = new List<Supplier>();
    public ICollection<FinancialRecord> FinancialRecords { get; set; } = new List<FinancialRecord>();
    public ICollection<ReserveFund> ReserveFunds { get; set; } = new List<ReserveFund>();
    public ICollection<Assembly> Assemblies { get; set; } = new List<Assembly>();
    public ICollection<SharedSpace> SharedSpaces { get; set; } = new List<SharedSpace>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    public ICollection<UsefulContact> UsefulContacts { get; set; } = new List<UsefulContact>();
    public ICollection<UserCondominium> UserCondominiums { get; set; } = new List<UserCondominium>();
    public ICollection<UnitMembership> UnitMemberships { get; set; } = new List<UnitMembership>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}

namespace Habitus.Domain.Entities;

public class Condominium
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Email { get; set; }  // Contact email for notifications
    public string? TaxIdEncrypted { get; set; }  // Encrypted NIF or NIPC (new field)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    
    // Payment Methods
    public string? PaymentIban { get; set; } = string.Empty; // Will be deprecated, use PaymentIbanEncrypted
    public string? PaymentIbanEncrypted { get; set; } = string.Empty; // Encrypted IBAN (new field)
    public string? PaymentInstructions { get; set; }
    public string? PaymentMbWay { get; set; }
    public string? PaymentMbReference { get; set; }
    
    // Payment Methods Availability (for residents)
    public bool PaymentBankTransferEnabled { get; set; } = true;
    public bool PaymentMbWayEnabled { get; set; } = false;
    public bool PaymentCardEnabled { get; set; } = false;
    
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
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}

namespace Habitus.Domain.Entities;

public class Building
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string AdminEmail { get; set; } = string.Empty;
    public ICollection<Unit> Units { get; set; } = new List<Unit>();
    public ICollection<Document> Documents { get; set; } = new List<Document>();
    public ICollection<Supplier> Suppliers { get; set; } = new List<Supplier>();
    public ICollection<FinancialRecord> FinancialRecords { get; set; } = new List<FinancialRecord>();
    public ICollection<Assembly> Assemblies { get; set; } = new List<Assembly>();
    public ICollection<SharedSpace> SharedSpaces { get; set; } = new List<SharedSpace>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    public ICollection<UsefulContact> UsefulContacts { get; set; } = new List<UsefulContact>();
}

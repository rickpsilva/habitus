namespace Habitus.Domain.Entities;

public enum MaintenanceStatus { Open, InProgress, Completed, Closed }
public enum MaintenancePriority { Low, Medium, High, Critical }

public class MaintenanceRequest
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public MaintenanceStatus Status { get; set; } = MaintenanceStatus.Open;
    public MaintenancePriority Priority { get; set; } = MaintenancePriority.Medium;
    public Guid CondominiumId { get; set; }
    public Guid UnitId { get; set; }
    public Guid CreatedBy { get; set; }
    public Guid? SupplierId { get; set; }
    public string? AdminComments { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
    public List<string> Photos { get; set; } = new();
    public string Location { get; set; } = string.Empty;
    public bool HasExpense { get; set; } = false;
    public decimal? ExpenseAmount { get; set; }
    public Guid? ExpenseCategoryId { get; set; }
    public ExpenseCategory? ExpenseCategory { get; set; }
    public Guid? InvoiceDocumentId { get; set; }
    public Condominium Condominium { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
    public Supplier? Supplier { get; set; }
    public ICollection<MaintenanceConfirmation> Confirmations { get; set; } = new List<MaintenanceConfirmation>();
    public ICollection<Intervention> Interventions { get; set; } = new List<Intervention>();
    public ICollection<Document> Documents { get; set; } = new List<Document>();
}

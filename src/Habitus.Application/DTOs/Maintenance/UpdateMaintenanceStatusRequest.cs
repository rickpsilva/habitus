namespace Habitus.Application.DTOs.Maintenance;

public class UpdateMaintenanceStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? SupplierId { get; set; }
    public string? AdminComments { get; set; }
    public bool HasExpense { get; set; } = false;
    public decimal? ExpenseAmount { get; set; }
    public Guid? ExpenseCategoryId { get; set; }
    public string? InvoiceDocumentId { get; set; }
}

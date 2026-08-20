namespace Habitus.Application.DTOs.ExpenseCategory;

public class CreateExpenseCategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public List<string> Hashtags { get; set; } = new();
    public bool IsActive { get; set; } = true;
    public Guid CondominiumId { get; set; }
}

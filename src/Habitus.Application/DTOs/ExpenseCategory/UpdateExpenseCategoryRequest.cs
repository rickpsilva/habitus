namespace Habitus.Application.DTOs.ExpenseCategory;

public class UpdateExpenseCategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public List<string> Hashtags { get; set; } = new();
    public bool IsActive { get; set; } = true;
}

namespace Habitus.Application.DTOs.ExpenseCategory;

public class ExpenseCategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<string> Hashtags { get; set; } = new();
    public bool IsActive { get; set; }
    public Guid CondominiumId { get; set; }
}

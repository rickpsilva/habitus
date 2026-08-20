namespace Habitus.Domain.Entities;

public class ExpenseCategory
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public List<string> Hashtags { get; set; } = new();
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;
}

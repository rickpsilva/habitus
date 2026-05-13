namespace Habitus.Domain.Entities;

public class ReceiptTemplateSettings
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public Condominium? Condominium { get; set; }
    
    public string? CompanyName { get; set; }
    public string? Address { get; set; }
    public string? TaxId { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Template { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

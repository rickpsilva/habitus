namespace Habitus.Domain.Entities;

public class Supplier
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Contact { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public Guid BuildingId { get; set; }
    public Building Building { get; set; } = null!;
    public ICollection<Intervention> Interventions { get; set; } = new List<Intervention>();
}

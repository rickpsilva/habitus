namespace Habitus.Domain.Entities;

public class SharedSpace
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public Guid CondominiumId { get; set; }
    public string Rules { get; set; } = string.Empty;
    public Condominium Condominium { get; set; } = null!;
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}

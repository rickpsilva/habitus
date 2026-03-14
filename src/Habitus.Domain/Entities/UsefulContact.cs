namespace Habitus.Domain.Entities;

public enum ContactCategory { Emergency, Service, Administrative }

public class UsefulContact
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public ContactCategory Category { get; set; }
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;
}

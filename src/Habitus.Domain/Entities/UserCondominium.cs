namespace Habitus.Domain.Entities;

/// <summary>
/// Join table for many-to-many relationship between Users (especially Managers) and Condominiums
/// </summary>
public class UserCondominium
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;
    
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public bool CanManage { get; set; } = true;  // Permission level within this condominium
}

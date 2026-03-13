namespace Habitus.Domain.Entities;

public enum QuotaPlanStatus
{
    Draft,      // Rascunho - em edição
    Active,     // Ativo - plano do ano atual
    Applied,    // Aplicado - valores já atualizados nas frações
    Archived    // Arquivado - plano de anos anteriores
}

public class QuotaPlan
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public int Year { get; set; }
    public decimal InflationRate { get; set; } // Taxa de inflação em percentagem (ex: 2.1 para 2.1%)
    public decimal ExtraordinaryQuota { get; set; } // Quota extraordinária fixa (opcional)
    public QuotaPlanStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? AppliedAt { get; set; } // Data em que foi aplicado às frações
    public string? AppliedBy { get; set; } // UserId que aplicou o plano
    
    // Navigation properties
    public Condominium Condominium { get; set; } = null!;
    public ICollection<QuotaCalculation> Calculations { get; set; } = new List<QuotaCalculation>();
}

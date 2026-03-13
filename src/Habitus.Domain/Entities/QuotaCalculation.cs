namespace Habitus.Domain.Entities;

public class QuotaCalculation
{
    public Guid Id { get; set; }
    public Guid QuotaPlanId { get; set; }
    public Guid UnitId { get; set; }
    
    // Valores base (antes da inflação)
    public decimal BaseMonthlyQuota { get; set; } // Quota mensal base da fração
    
    // Valores calculados
    public decimal InflationAmount { get; set; } // Valor da inflação calculada
    public decimal MonthlyQuota { get; set; } // Quota mensal com inflação
    public decimal QuarterlyQuota { get; set; } // Quota trimestral (mensal * 3)
    public decimal AnnualQuota { get; set; } // Quota anual (mensal * 12)
    
    // Navigation properties
    public QuotaPlan QuotaPlan { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}

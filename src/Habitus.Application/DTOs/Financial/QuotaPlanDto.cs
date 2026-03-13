namespace Habitus.Application.DTOs.Financial;

public class QuotaCalculationDto
{
    public Guid Id { get; set; }
    public Guid UnitId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public decimal BaseMonthlyQuota { get; set; }
    public decimal InflationAmount { get; set; }
    public decimal MonthlyQuota { get; set; }
    public decimal QuarterlyQuota { get; set; }
    public decimal AnnualQuota { get; set; }
}

public class QuotaPlanDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public int Year { get; set; }
    public decimal InflationRate { get; set; }
    public decimal ExtraordinaryQuota { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? AppliedAt { get; set; }
    public string? AppliedBy { get; set; }
    public List<QuotaCalculationDto> Calculations { get; set; } = new();
}

public class CreateQuotaPlanRequest
{
    public int Year { get; set; }
    public decimal InflationRate { get; set; }
    public decimal ExtraordinaryQuota { get; set; }
}

public class UpdateQuotaPlanRequest
{
    public decimal InflationRate { get; set; }
    public decimal ExtraordinaryQuota { get; set; }
}

public class ApplyQuotaPlanRequest
{
    // Pode estar vazio - apenas trigger para aplicar o plano
}

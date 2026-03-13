namespace Habitus.Application.DTOs.Financial;

public class ReserveFundDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public int FiscalYear { get; set; }
    public decimal OpeningBalance { get; set; }
    public decimal Deposits { get; set; }
    public decimal Withdrawals { get; set; }
    public decimal ClosingBalance { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateReserveFundRequest
{
    public Guid CondominiumId { get; set; }
    public int FiscalYear { get; set; }
    public decimal OpeningBalance { get; set; }
}

public class UpdateReserveFundRequest
{
    public decimal? Deposits { get; set; }
    public decimal? Withdrawals { get; set; }
}

public class YearClosureRequest
{
    public Guid CondominiumId { get; set; }
    public int FiscalYear { get; set; }
}

public class FinancialDashboardDto
{
    // Current year data
    public int CurrentYear { get; set; }
    public decimal CurrentYearIncome { get; set; }
    public decimal CurrentYearExpenses { get; set; }
    public decimal CurrentYearBalance { get; set; }
    
    // Reserve fund data
    public decimal ReserveFundBalance { get; set; }
    public decimal ReserveFundDeposits { get; set; }
    public decimal ReserveFundWithdrawals { get; set; }
    
    // Records for current year
    public List<FinancialRecordDto> CurrentYearRecords { get; set; } = new();
    
    // Available fiscal years for filtering
    public List<int> AvailableFiscalYears { get; set; } = new();

    // Announcements metrics (Noise/Perturbações)
    public int NoiseAnnouncementsCurrentYear { get; set; }
    public int NoiseAnnouncementsPreviousYear { get; set; }
}

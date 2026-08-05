namespace Habitus.Domain.Entities;

public enum FinancialType { Income, Expense }

public enum IncomeCategory
{
    MonthlyFees = 0,        // Quotas mensais
    ExtraordinaryFees = 1,  // Quotas extraordinárias
    LateFeeInterest = 2,    // Juros de mora
    OtherIncome = 3         // Outras receitas
}

public enum ReserveFundCategory
{
    Transfer = 0,   // Transferência para fundo de reserva
    Withdrawal = 1  // Levantamento do fundo (grandes obras)
}

public class FinancialRecord
{
    public Guid Id { get; set; }
    public FinancialType Type { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public int FiscalYear { get; set; } // Ano fiscal (extraído de Date)
    public IncomeCategory? IncomeCategory { get; set; }
    public Guid? ExpenseCategoryId { get; set; }
    public ExpenseCategory? ExpenseCategory { get; set; }
    public ReserveFundCategory? ReserveFundCategory { get; set; }
    public Guid CondominiumId { get; set; }
    public string? ReceiptUrl { get; set; }
    public Condominium Condominium { get; set; } = null!;
}

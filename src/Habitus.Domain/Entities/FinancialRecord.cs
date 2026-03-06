namespace Habitus.Domain.Entities;

public enum FinancialType { Income, Expense }

public enum FinancialCategory
{
    // Income categories
    MonthlyFees,        // Quotas mensais
    ExtraordinaryFees,  // Quotas extraordinárias
    LateFeeInterest,    // Juros de mora
    OtherIncome,        // Outras receitas
    
    // Expense categories
    Maintenance,        // Manutenção regular
    Insurance,          // Seguros
    Utilities,          // Consumos comuns (água, luz, gás)
    Administration,     // Honorários administração
    Services,           // Serviços (elevador, limpeza, etc)
    Property,           // IMI parte comum
    Legal,              // Serviços jurídicos
    Accounting,         // Contabilista
    OtherExpense,       // Outras despesas
    
    // Reserve fund categories
    ReserveFundTransfer,  // Transferência para fundo de reserva
    ReserveFundWithdrawal // Levantamento do fundo (grandes obras)
}

public class FinancialRecord
{
    public Guid Id { get; set; }
    public FinancialType Type { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public int FiscalYear { get; set; } // Ano fiscal (extraído de Date)
    public FinancialCategory Category { get; set; }
    public Guid CondominiumId { get; set; }
    public string? ReceiptUrl { get; set; }
    public Condominium Condominium { get; set; } = null!;
}

namespace Habitus.Domain.Entities;

/// <summary>
/// Fundo de Reserva do condomínio - obrigatório por lei (Lei 6/2006).
/// Acumula ao longo dos anos e destina-se apenas a grandes obras e emergências.
/// </summary>
public class ReserveFund
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public int FiscalYear { get; set; }
    public decimal OpeningBalance { get; set; } // Saldo inicial do ano
    public decimal Deposits { get; set; }       // Entradas (transferências da conta corrente)
    public decimal Withdrawals { get; set; }    // Saídas (obras, emergências)
    public decimal ClosingBalance { get; set; } // Saldo final do ano
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    public Condominium Condominium { get; set; } = null!;
}

namespace Habitus.Domain.Entities;

public enum ReservationStatus 
{ 
    Pending,                  // Pendente - aguarda aprovação
    Approved,                 // Aprovado pelo Admin
    Rejected,                 // Rejeitado pelo Admin
    CancellationRequested,    // Pedido de cancelamento
    Cancelled,                // Cancelado
    Completed                 // Terminado (data fim passou)
}

public class Reservation
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public Guid SpaceId { get; set; }
    public Guid UserId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? AdminComments { get; set; }
    public Condominium Condominium { get; set; } = null!;
    public SharedSpace Space { get; set; } = null!;
    public User User { get; set; } = null!;
}

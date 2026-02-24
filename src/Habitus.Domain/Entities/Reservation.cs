namespace Habitus.Domain.Entities;

public enum ReservationStatus { Pending, Confirmed, Cancelled }

public class Reservation
{
    public Guid Id { get; set; }
    public Guid SpaceId { get; set; }
    public Guid ResidentId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;
    public SharedSpace Space { get; set; } = null!;
}

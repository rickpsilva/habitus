namespace Habitus.Application.DTOs.Reservations;

public class CreateReservationRequest
{
    public Guid SpaceId { get; set; }
    public Guid ResidentId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}

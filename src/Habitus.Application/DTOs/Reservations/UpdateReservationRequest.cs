namespace Habitus.Application.DTOs.Reservations;

public class UpdateReservationRequest
{
    public Guid SpaceId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}

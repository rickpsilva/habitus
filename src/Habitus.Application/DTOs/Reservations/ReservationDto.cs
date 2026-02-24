namespace Habitus.Application.DTOs.Reservations;

public class ReservationDto
{
    public Guid Id { get; set; }
    public Guid SpaceId { get; set; }
    public Guid ResidentId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Status { get; set; } = string.Empty;
}

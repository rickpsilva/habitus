namespace Habitus.Application.DTOs.SharedSpaces;

public class SharedSpaceDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public Guid CondominiumId { get; set; }
    public string Rules { get; set; } = string.Empty;
    public decimal ReservationFee { get; set; }
}

using Habitus.Domain.Entities;

namespace Habitus.Application.DTOs.Units;

public class CreateUnitRequest
{
    public Guid CondominiumId { get; set; }
    public string Number { get; set; } = string.Empty;
    public int Floor { get; set; }
    public UnitType Type { get; set; }
    public string? ApartmentNumber { get; set; }
    public decimal Permillage { get; set; }
}

public class UpdateUnitRequest
{
    public Guid CondominiumId { get; set; }
    public string Number { get; set; } = string.Empty;
    public int Floor { get; set; }
    public UnitType Type { get; set; }
    public string? ApartmentNumber { get; set; }
    public decimal Permillage { get; set; }
}

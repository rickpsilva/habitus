namespace Habitus.Application.DTOs.SharedSpaces;

public class UpdateSharedSpaceRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string Rules { get; set; } = string.Empty;
}

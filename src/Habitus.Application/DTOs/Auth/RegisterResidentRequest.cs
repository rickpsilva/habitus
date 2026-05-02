namespace Habitus.Application.DTOs.Auth;

public class RegisterResidentRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public Guid UnitId { get; set; } // Required — residents must belong to a unit
}

public class RegisterResidentResponse
{
    public string Message { get; set; } = string.Empty;
}

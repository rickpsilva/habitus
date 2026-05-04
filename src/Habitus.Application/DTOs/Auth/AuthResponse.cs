namespace Habitus.Application.DTOs.Auth;

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Role { get; set; }  // 0=Manager, 1=Admin, 2=Resident
    public Guid? CondominiumId { get; set; }
    public Guid? UnitId { get; set; }
    public List<Guid> AccessibleCondominiums { get; set; } = new();  // For Managers
    public bool RequiresTwoFactor { get; set; }
    public string? ChallengeId { get; set; }
    public List<string> AvailableTwoFactorMethods { get; set; } = new();
}

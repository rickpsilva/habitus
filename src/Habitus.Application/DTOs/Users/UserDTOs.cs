namespace Habitus.Application.DTOs.Users;

public class CreateUserRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "Resident"; // Accepts: "Manager"/"0", "Admin"/"1", "Resident"/"2"
    public Guid? CondominiumId { get; set; }  // Required for Admin and Resident
    public Guid? UnitId { get; set; }  // Optional for Admin, required for Resident
}

public class UpdateUserRequest
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // Accepts: "Manager"/"0", "Admin"/"1", "Resident"/"2"
    public Guid? CondominiumId { get; set; }
    public Guid? UnitId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateUserPasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class UserResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public int Role { get; set; } // 0=Manager, 1=Admin, 2=Resident
    public Guid? CondominiumId { get; set; }
    public string? CondominiumName { get; set; }
    public Guid? UnitId { get; set; }
    public string? UnitNumber { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class CondominiumActiveUsersDto
{
    public Guid CondominiumId { get; set; }
    public string CondominiumName { get; set; } = string.Empty;
    public int ActiveUsersLastMonth { get; set; }
}

public class AssignUserToCondominiumRequest
{
    public Guid UserId { get; set; }
    public Guid CondominiumId { get; set; }
    public bool CanManage { get; set; } = true;
}

public class PendingUserDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public Guid? UnitId { get; set; }
    public string? UnitNumber { get; set; }
    public Guid? CondominiumId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CondominiumPublicDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
}

public class UnitPublicDto
{
    public Guid Id { get; set; }
    public string Number { get; set; } = string.Empty;
    public int Floor { get; set; }
    public string? ApartmentNumber { get; set; }
}

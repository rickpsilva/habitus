using Habitus.Application.DTOs.Users;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class UserService
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<UserCondominium> _userCondominiumRepository;
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<Unit> _unitRepository;

    public UserService(
        IRepository<User> userRepository,
        IRepository<UserCondominium> userCondominiumRepository,
        IRepository<Condominium> condominiumRepository,
        IRepository<Unit> unitRepository)
    {
        _userRepository = userRepository;
        _userCondominiumRepository = userCondominiumRepository;
        _condominiumRepository = condominiumRepository;
        _unitRepository = unitRepository;
    }

    public async Task<IEnumerable<UserResponse>> GetAllUsersAsync()
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => true,
            "Condominium", "Unit");

        return users.Select(MapToResponse);
    }

    public async Task<IEnumerable<UserResponse>> GetUsersByCondominiumAsync(Guid condominiumId)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.CondominiumId == condominiumId,
            "Condominium", "Unit");

        return users.Select(MapToResponse);
    }

    public async Task<UserResponse?> GetUserByIdAsync(Guid id)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.Id == id,
            "Condominium", "Unit");

        var user = users.FirstOrDefault();
        return user != null ? MapToResponse(user) : null;
    }

    public async Task<UserResponse> CreateUserAsync(CreateUserRequest request)
    {
        // Handle both numeric and string role values
        UserRole userRole;
        if (int.TryParse(request.Role, out int roleNumber))
        {
            // Numeric role (0=Manager, 1=Admin, 2=Resident)
            userRole = (UserRole)roleNumber;
        }
        else if (!Enum.TryParse<UserRole>(request.Role, true, out userRole))
        {
            throw new ArgumentException($"Invalid role: {request.Role}");
        }

        // Validate role-specific requirements
        if ((userRole == UserRole.Admin || userRole == UserRole.Resident) && !request.CondominiumId.HasValue)
        {
            throw new InvalidOperationException("CondominiumId is required for Admin and Resident roles.");
        }

        if (userRole == UserRole.Resident && !request.UnitId.HasValue)
        {
            throw new InvalidOperationException("UnitId is required for Resident role.");
        }

        // Check if email already exists
        var existing = await _userRepository.FindAsync(u => u.Email == request.Email);
        if (existing.Any())
        {
            throw new InvalidOperationException($"User with email {request.Email} already exists.");
        }

        // Validate condominium exists
        if (request.CondominiumId.HasValue)
        {
            var condominium = await _condominiumRepository.GetByIdAsync(request.CondominiumId.Value);
            if (condominium == null)
            {
                throw new InvalidOperationException($"Condominium with ID {request.CondominiumId} not found.");
            }
        }

        // Validate unit exists and belongs to the condominium
        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);
            if (unit == null)
            {
                throw new InvalidOperationException($"Unit with ID {request.UnitId} not found.");
            }
            if (request.CondominiumId.HasValue && unit.CondominiumId != request.CondominiumId.Value)
            {
                throw new InvalidOperationException("Unit does not belong to the specified condominium.");
            }
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            Role = userRole,
            CondominiumId = request.CondominiumId,
            UnitId = request.UnitId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddAsync(user);
        await _userRepository.SaveChangesAsync();

        // Create UserCondominium relationship for non-Manager users
        if (userRole != UserRole.Manager && request.CondominiumId.HasValue)
        {
            var userCondominium = new UserCondominium
            {
                UserId = user.Id,
                CondominiumId = request.CondominiumId.Value,
                GrantedAt = DateTime.UtcNow,
                CanManage = userRole == UserRole.Admin
            };
            await _userCondominiumRepository.AddAsync(userCondominium);
            await _userCondominiumRepository.SaveChangesAsync();
        }

        return MapToResponse(user);
    }

    public async Task<UserResponse> UpdateUserAsync(UpdateUserRequest request)
    {
        var user = await _userRepository.GetByIdAsync(request.Id);
        if (user == null)
        {
            throw new InvalidOperationException($"User with ID {request.Id} not found.");
        }

        // Handle both numeric and string role values
        UserRole userRole;
        if (int.TryParse(request.Role, out int roleNumber))
        {
            // Numeric role (0=Manager, 1=Admin, 2=Resident)
            userRole = (UserRole)roleNumber;
        }
        else if (!Enum.TryParse<UserRole>(request.Role, true, out userRole))
        {
            throw new ArgumentException($"Invalid role: {request.Role}");
        }

        // Update properties
        user.Name = request.Name;
        user.Email = request.Email;
        user.Phone = request.Phone;
        user.Role = userRole;
        user.CondominiumId = request.CondominiumId;
        user.UnitId = request.UnitId;
        user.IsActive = request.IsActive;

        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        return MapToResponse(user);
    }

    public async Task<bool> DeleteUserAsync(Guid id)
    {
        var user = await _userRepository.GetByIdAsync(id);
        if (user == null) return false;

        _userRepository.Remove(user);
        await _userRepository.SaveChangesAsync();
        return true;
    }

    public async Task AssignUserToCondominiumAsync(AssignUserToCondominiumRequest request)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId);
        if (user == null)
        {
            throw new InvalidOperationException($"User with ID {request.UserId} not found.");
        }

        var condominium = await _condominiumRepository.GetByIdAsync(request.CondominiumId);
        if (condominium == null)
        {
            throw new InvalidOperationException($"Condominium with ID {request.CondominiumId} not found.");
        }

        // Check if relationship already exists
        var existing = await _userCondominiumRepository.FindAsync(
            uc => uc.UserId == request.UserId && uc.CondominiumId == request.CondominiumId);
        
        if (existing.Any())
        {
            throw new InvalidOperationException("User is already assigned to this condominium.");
        }

        var userCondominium = new UserCondominium
        {
            UserId = request.UserId,
            CondominiumId = request.CondominiumId,
            GrantedAt = DateTime.UtcNow,
            CanManage = request.CanManage
        };

        await _userCondominiumRepository.AddAsync(userCondominium);
        await _userCondominiumRepository.SaveChangesAsync();
    }

    private UserResponse MapToResponse(User user)
    {
        return new UserResponse
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Role = (int)user.Role,
            CondominiumId = user.CondominiumId,
            CondominiumName = user.Condominium?.Name,
            UnitId = user.UnitId,
            UnitNumber = user.Unit?.Number,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt
        };
    }
}

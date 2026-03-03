using Habitus.Application.DTOs.Residents;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

/// <summary>
/// DEPRECATED: Use UserService instead for managing users.
/// This service is kept for backward compatibility during migration.
/// </summary>
[Obsolete("Use UserService instead. This will be removed in a future version.")]
public class ResidentService
{
    private readonly IRepository<Resident> _repository;

    public ResidentService(IRepository<Resident> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<ResidentDto>> GetAllAsync()
    {
        var residents = await _repository.GetAllAsync();
        return residents.Select(MapToDto);
    }

    public async Task<IEnumerable<ResidentDto>> GetByUnitAsync(Guid unitId)
    {
        var residents = await _repository.FindAsync(r => r.UnitId == unitId);
        return residents.Select(MapToDto);
    }

    public async Task<ResidentDto?> GetByIdAsync(Guid id)
    {
        var resident = await _repository.GetByIdAsync(id);
        return resident == null ? null : MapToDto(resident);
    }

    public async Task<ResidentDto> CreateAsync(CreateResidentRequest request)
    {
        var resident = new Resident
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            UnitId = request.UnitId,
            Role = request.Role,  // Now a string instead of enum
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow
        };
        await _repository.AddAsync(resident);
        await _repository.SaveChangesAsync();
        return MapToDto(resident);
    }

    public async Task<ResidentDto?> UpdateAsync(Guid id, UpdateResidentRequest request)
    {
        var resident = await _repository.GetByIdAsync(id);
        if (resident == null) return null;
        resident.Name = request.Name;
        resident.Phone = request.Phone;
        _repository.Update(resident);
        await _repository.SaveChangesAsync();
        return MapToDto(resident);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var resident = await _repository.GetByIdAsync(id);
        if (resident == null) return false;
        _repository.Remove(resident);
        await _repository.SaveChangesAsync();
        return true;
    }

    private static ResidentDto MapToDto(Resident r) => new()
    {
        Id = r.Id,
        Name = r.Name,
        Email = r.Email,
        Phone = r.Phone,
        UnitId = r.UnitId,
        Role = r.Role.ToString(),
        CreatedAt = r.CreatedAt
    };
}

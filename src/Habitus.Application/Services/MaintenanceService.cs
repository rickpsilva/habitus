using Habitus.Application.DTOs.Maintenance;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class MaintenanceService
{
    private readonly IRepository<MaintenanceRequest> _repository;

    public MaintenanceService(IRepository<MaintenanceRequest> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<MaintenanceRequestDto>> GetAllAsync()
    {
        var requests = await _repository.GetAllAsync();
        return requests.Select(MapToDto);
    }

    public async Task<MaintenanceRequestDto?> GetByIdAsync(Guid id)
    {
        var request = await _repository.GetByIdAsync(id);
        return request == null ? null : MapToDto(request);
    }

    public async Task<MaintenanceRequestDto> CreateAsync(CreateMaintenanceRequest request)
    {
        var entity = new MaintenanceRequest
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            Priority = Enum.Parse<MaintenancePriority>(request.Priority),
            UnitId = request.UnitId,
            CreatedBy = request.CreatedBy,
            Photos = request.Photos,
            Location = request.Location,
            Status = MaintenanceStatus.Open,
            CreatedAt = DateTime.UtcNow
        };
        await _repository.AddAsync(entity);
        await _repository.SaveChangesAsync();
        return MapToDto(entity);
    }

    public async Task<MaintenanceRequestDto?> UpdateAsync(Guid id, UpdateMaintenanceRequest request)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return null;
        if (request.Status != null) entity.Status = Enum.Parse<MaintenanceStatus>(request.Status);
        if (request.Priority != null) entity.Priority = Enum.Parse<MaintenancePriority>(request.Priority);
        if (request.Description != null) entity.Description = request.Description;
        if (entity.Status == MaintenanceStatus.Resolved) entity.ResolvedAt = DateTime.UtcNow;
        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return MapToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return false;
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return true;
    }

    private static MaintenanceRequestDto MapToDto(MaintenanceRequest r) => new()
    {
        Id = r.Id,
        Title = r.Title,
        Description = r.Description,
        Status = r.Status.ToString(),
        Priority = r.Priority.ToString(),
        UnitId = r.UnitId,
        CreatedBy = r.CreatedBy,
        CreatedAt = r.CreatedAt,
        ResolvedAt = r.ResolvedAt,
        Photos = r.Photos,
        Location = r.Location
    };
}

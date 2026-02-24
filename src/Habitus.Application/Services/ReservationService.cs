using Habitus.Application.DTOs.Reservations;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class ReservationService
{
    private readonly IRepository<Reservation> _repository;

    public ReservationService(IRepository<Reservation> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<ReservationDto>> GetAllAsync()
    {
        var items = await _repository.GetAllAsync();
        return items.Select(MapToDto);
    }

    public async Task<ReservationDto?> GetByIdAsync(Guid id)
    {
        var item = await _repository.GetByIdAsync(id);
        return item == null ? null : MapToDto(item);
    }

    public async Task<(ReservationDto? Dto, string? Error)> CreateAsync(CreateReservationRequest request)
    {
        var existing = await _repository.FindAsync(r =>
            r.SpaceId == request.SpaceId &&
            r.Status != ReservationStatus.Cancelled &&
            r.StartTime < request.EndTime &&
            r.EndTime > request.StartTime);

        if (existing.Any())
            return (null, "The space is already reserved for the requested time slot.");

        var entity = new Reservation
        {
            Id = Guid.NewGuid(),
            SpaceId = request.SpaceId,
            ResidentId = request.ResidentId,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Status = ReservationStatus.Pending
        };
        await _repository.AddAsync(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return false;
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return true;
    }

    private static ReservationDto MapToDto(Reservation r) => new()
    {
        Id = r.Id,
        SpaceId = r.SpaceId,
        ResidentId = r.ResidentId,
        StartTime = r.StartTime,
        EndTime = r.EndTime,
        Status = r.Status.ToString()
    };
}

using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Reservations;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class ReservationService
{
    private readonly IRepository<Reservation> _repository;
    private readonly IRepository<SharedSpace> _spaceRepository;

    public ReservationService(IRepository<Reservation> repository, IRepository<SharedSpace> spaceRepository)
    {
        _repository = repository;
        _spaceRepository = spaceRepository;
    }

    public async Task<IEnumerable<ReservationDto>> GetAllAsync()
    {
        var items = await _repository.GetAllAsync();
        return items.Select(MapToDto);
    }

    public async Task<PaginatedResponse<ReservationDto>> GetPagedAsync(int page, int pageSize, string? search = null)
    {
        var items = await _repository.GetAllAsync();
        var dtos = items.Select(MapToDto).OrderByDescending(r => r.StartTime);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(r =>
                (r.AdminComments ?? "").ToLower().Contains(searchLower)
            ).OrderByDescending(r => r.StartTime);
        }
        
        return PaginationHelper.Paginate(dtos, page, pageSize);
    }

    public async Task<ReservationDto?> GetByIdAsync(Guid id)
    {
        var item = await _repository.GetByIdAsync(id);
        return item == null ? null : MapToDto(item);
    }

    public async Task<(ReservationDto? Dto, string? Error)> CreateAsync(CreateReservationRequest request)
    {
        // Get SharedSpace to obtain CondominiumId
        var space = await _spaceRepository.GetByIdAsync(request.SpaceId);
        if (space == null)
            return (null, "Shared space not found.");

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
            CondominiumId = space.CondominiumId,
            SpaceId = request.SpaceId,
            UserId = request.UserId,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Status = ReservationStatus.Pending,
            CreatedAt = DateTime.UtcNow
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

    public async Task<(ReservationDto? Dto, string? Error)> UpdateAsync(Guid id, UpdateReservationRequest request)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reservation not found.");

        // Get SharedSpace to validate and obtain CondominiumId
        var space = await _spaceRepository.GetByIdAsync(request.SpaceId);
        if (space == null)
            return (null, "Shared space not found.");

        // Check for conflicts with other reservations (excluding current one)
        var existing = await _repository.FindAsync(r =>
            r.Id != id &&
            r.SpaceId == request.SpaceId &&
            r.Status != ReservationStatus.Cancelled &&
            r.StartTime < request.EndTime &&
            r.EndTime > request.StartTime);

        if (existing.Any())
            return (null, "The space is already reserved for the requested time slot.");

        // Update entity
        entity.SpaceId = request.SpaceId;
        entity.StartTime = request.StartTime;
        entity.EndTime = request.EndTime;
        entity.CondominiumId = space.CondominiumId;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> ApproveAsync(Guid id, ChangeReservationStatusRequest request)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reservation not found.");

        if (entity.Status != ReservationStatus.Pending)
            return (null, "Only pending reservations can be approved.");

        entity.Status = ReservationStatus.Approved;
        if (!string.IsNullOrWhiteSpace(request.AdminComments))
            entity.AdminComments = request.AdminComments;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> RejectAsync(Guid id, ChangeReservationStatusRequest request)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reservation not found.");

        if (entity.Status != ReservationStatus.Pending)
            return (null, "Only pending reservations can be rejected.");

        entity.Status = ReservationStatus.Rejected;
        if (!string.IsNullOrWhiteSpace(request.AdminComments))
            entity.AdminComments = request.AdminComments;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> RequestCancellationAsync(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reservation not found.");

        if (entity.Status != ReservationStatus.Approved)
            return (null, "Only approved reservations can be cancelled.");

        entity.Status = ReservationStatus.CancellationRequested;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> ApproveCancellationAsync(Guid id, ChangeReservationStatusRequest request)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reservation not found.");

        if (entity.Status != ReservationStatus.CancellationRequested)
            return (null, "Only reservations with cancellation request can be cancelled.");

        entity.Status = ReservationStatus.Cancelled;
        if (!string.IsNullOrWhiteSpace(request.AdminComments))
            entity.AdminComments = request.AdminComments;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> RejectCancellationAsync(Guid id, ChangeReservationStatusRequest request)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reservation not found.");

        if (entity.Status != ReservationStatus.CancellationRequested)
            return (null, "Only reservations with cancellation request can be rejected.");

        entity.Status = ReservationStatus.Approved;
        if (!string.IsNullOrWhiteSpace(request.AdminComments))
            entity.AdminComments = request.AdminComments;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    private static ReservationDto MapToDto(Reservation r) => new()
    {
        Id = r.Id,
        CondominiumId = r.CondominiumId,
        SpaceId = r.SpaceId,
        UserId = r.UserId,
        StartTime = r.StartTime,
        EndTime = r.EndTime,
        Status = r.Status.ToString(),
        CreatedAt = r.CreatedAt,
        AdminComments = r.AdminComments
    };
}

using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Reservations;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class ReservationService
{
    private readonly IRepository<Reservation> _repository;
    private readonly IRepository<SharedSpace> _spaceRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<FinancialRecord> _financialRepository;
    private readonly IRepository<Notification> _notificationRepository;
    private readonly INotificationDispatchService _notificationDispatchService;

    public ReservationService(
        IRepository<Reservation> repository,
        IRepository<SharedSpace> spaceRepository,
        IRepository<User> userRepository,
        IRepository<FinancialRecord> financialRepository,
        IRepository<Notification> notificationRepository,
        INotificationDispatchService notificationDispatchService)
    {
        _repository = repository;
        _spaceRepository = spaceRepository;
        _userRepository = userRepository;
        _financialRepository = financialRepository;
        _notificationRepository = notificationRepository;
        _notificationDispatchService = notificationDispatchService;
    }

    public async Task<IEnumerable<ReservationDto>> GetAllAsync(Guid condominiumId)
    {
        var items = await _repository.FindAsync(r => r.CondominiumId == condominiumId);
        return items.Select(MapToDto);
    }

    public async Task<PaginatedResponse<ReservationDto>> GetPagedAsync(int page, int pageSize, Guid condominiumId, string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var searchLower = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        var paged = await _repository.GetPagedAsync(
            page,
            pageSize,
            r => r.CondominiumId == condominiumId &&
                 (searchLower == null || (r.AdminComments ?? "").ToLower().Contains(searchLower)),
            r => r.StartTime,
            descending: true);

        return new PaginatedResponse<ReservationDto>
        {
            Items = paged.Items.Select(MapToDto).ToList(),
            Page = paged.Page,
            PageSize = paged.PageSize,
            TotalItems = paged.TotalItems,
            TotalPages = paged.TotalPages
        };
    }

    public async Task<ReservationDto?> GetByIdAsync(Guid id, Guid condominiumId)
    {
        var item = await _repository.GetByIdAsync(id);
        if (item == null || item.CondominiumId != condominiumId) return null;
        return MapToDto(item);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid condominiumId)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null || entity.CondominiumId != condominiumId) return false;
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return true;
    }

    public async Task<(ReservationDto? Dto, string? Error)> CreateAsync(Guid condominiumId, CreateReservationRequest request)
    {
        if (request.EndTime <= request.StartTime)
            return (null, "A data de fim deve ser posterior à data de início.");

        // Get SharedSpace to obtain CondominiumId
        var space = await _spaceRepository.GetByIdAsync(request.SpaceId);
        if (space == null)
            return (null, "Espaço comum não encontrado.");
        if (space.CondominiumId != condominiumId)
            return (null, "O espaço comum não pertence ao condomínio da rota.");

        // Check that the user has an associated unit (fração)
        var user = await _userRepository.GetByIdAsync(request.UserId);
        if (user == null)
            return (null, "Utilizador não encontrado.");
        if (user.CondominiumId != condominiumId)
            return (null, "O utilizador não pertence ao condomínio da rota.");
        if (!user.UnitId.HasValue)
            return (null, "Apenas utilizadores com uma fração associada podem efetuar reservas.");

        // Validate that start time is not in the past
        if (request.StartTime < DateTime.UtcNow)
            return (null, "Não é possível criar reservas para datas passadas.");

        var existing = await _repository.FindAsync(r =>
            r.SpaceId == request.SpaceId &&
            r.Status != ReservationStatus.Cancelled &&
            r.Status != ReservationStatus.Rejected &&
            r.StartTime < request.EndTime &&
            r.EndTime > request.StartTime);

        if (existing.Any())
            return (null, "O espaço já se encontra reservado para o período solicitado.");

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

        // Create financial record for the reservation fee (income/pending debt)
        if (space.ReservationFee > 0)
        {
            var financialRecord = new FinancialRecord
            {
                Id = Guid.NewGuid(),
                Type = FinancialType.Income,
                Amount = space.ReservationFee,
                Description = $"Reserva (pendente): {space.Name} - {request.StartTime:dd/MM/yyyy HH:mm}",
                Date = DateTime.UtcNow,
                FiscalYear = DateTime.UtcNow.Year,
                Category = FinancialCategory.OtherIncome,
                CondominiumId = space.CondominiumId
            };
            await _financialRepository.AddAsync(financialRecord);
            await _financialRepository.SaveChangesAsync();
        }

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = "Reserva pendente de aprovação",
            Message = $"Nova reserva para '{space.Name}' em {request.StartTime:dd/MM/yyyy HH:mm} aguarda aprovação.",
            Type = NotificationType.Alert,
            TargetRole = UserRole.Admin.ToString(),
            CondominiumId = space.CondominiumId,
            SentAt = DateTime.UtcNow,
            IsRead = false
        };
        await _notificationRepository.AddAsync(notification);
        await _notificationRepository.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> UpdateAsync(Guid id, Guid condominiumId, UpdateReservationRequest request)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reserva não encontrada.");
        if (entity.CondominiumId != condominiumId)
            return (null, "Reserva não encontrada.");

        if (request.EndTime <= request.StartTime)
            return (null, "A data de fim deve ser posterior à data de início.");

        // Get SharedSpace to validate and obtain CondominiumId
        var space = await _spaceRepository.GetByIdAsync(request.SpaceId);
        if (space == null)
            return (null, "Espaço comum não encontrado.");
        if (space.CondominiumId != condominiumId)
            return (null, "O espaço comum não pertence ao condomínio da rota.");

        // Validate that start time is not in the past
        if (request.StartTime < DateTime.UtcNow)
            return (null, "Não é possível editar reservas para datas passadas.");

        // Check for conflicts with other reservations (excluding current one)
        var existing = await _repository.FindAsync(r =>
            r.Id != id &&
            r.SpaceId == request.SpaceId &&
            r.Status != ReservationStatus.Cancelled &&
            r.Status != ReservationStatus.Rejected &&
            r.StartTime < request.EndTime &&
            r.EndTime > request.StartTime);

        if (existing.Any())
            return (null, "O espaço já se encontra reservado para o período solicitado.");

        // Update entity
        entity.SpaceId = request.SpaceId;
        entity.StartTime = request.StartTime;
        entity.EndTime = request.EndTime;
        entity.CondominiumId = condominiumId;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> ApproveAsync(Guid id, ChangeReservationStatusRequest request, Guid condominiumId)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reserva não encontrada.");
        if (entity.CondominiumId != condominiumId)
            return (null, "Reserva não encontrada.");

        if (entity.Status != ReservationStatus.Pending)
            return (null, "Apenas reservas pendentes podem ser aprovadas.");

        entity.Status = ReservationStatus.Approved;
        if (!string.IsNullOrWhiteSpace(request.AdminComments))
            entity.AdminComments = request.AdminComments;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> RejectAsync(Guid id, ChangeReservationStatusRequest request, Guid condominiumId)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reserva não encontrada.");
        if (entity.CondominiumId != condominiumId)
            return (null, "Reserva não encontrada.");

        if (entity.Status != ReservationStatus.Pending)
            return (null, "Apenas reservas pendentes podem ser rejeitadas.");

        entity.Status = ReservationStatus.Rejected;
        if (!string.IsNullOrWhiteSpace(request.AdminComments))
            entity.AdminComments = request.AdminComments;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> RequestCancellationAsync(Guid id, Guid condominiumId)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reserva não encontrada.");
        if (entity.CondominiumId != condominiumId)
            return (null, "Reserva não encontrada.");

        if (entity.Status != ReservationStatus.Approved)
            return (null, "Apenas reservas aprovadas podem ser canceladas.");

        entity.Status = ReservationStatus.CancellationRequested;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();

        var space = await _spaceRepository.GetByIdAsync(entity.SpaceId);
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = "Pedido de cancelamento de reserva",
            Message = $"A reserva de '{space?.Name ?? "espaço comum"}' para {entity.StartTime:dd/MM/yyyy HH:mm} aguarda decisão do admin.",
            Type = NotificationType.Alert,
            TargetRole = UserRole.Admin.ToString(),
            CondominiumId = condominiumId,
            SentAt = DateTime.UtcNow,
            IsRead = false
        };
        await _notificationRepository.AddAsync(notification);
        await _notificationRepository.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> ApproveCancellationAsync(Guid id, ChangeReservationStatusRequest request, Guid condominiumId)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reserva não encontrada.");
        if (entity.CondominiumId != condominiumId)
            return (null, "Reserva não encontrada.");

        if (entity.Status != ReservationStatus.CancellationRequested)
            return (null, "Apenas reservas com pedido de cancelamento podem ser canceladas.");

        entity.Status = ReservationStatus.Cancelled;
        if (!string.IsNullOrWhiteSpace(request.AdminComments))
            entity.AdminComments = request.AdminComments;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return (MapToDto(entity), null);
    }

    public async Task<(ReservationDto? Dto, string? Error)> RejectCancellationAsync(Guid id, ChangeReservationStatusRequest request, Guid condominiumId)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null)
            return (null, "Reserva não encontrada.");
        if (entity.CondominiumId != condominiumId)
            return (null, "Reserva não encontrada.");

        if (entity.Status != ReservationStatus.CancellationRequested)
            return (null, "Apenas reservas com pedido de cancelamento podem ser rejeitadas.");

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

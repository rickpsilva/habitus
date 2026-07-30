using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Maintenance;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class MaintenanceService
{
    private readonly IRepository<MaintenanceRequest> _repository;
    private readonly IRepository<Notification> _notificationRepository;
    private readonly IRepository<FinancialRecord> _financialRepository;
    private readonly INotificationDispatchService _notificationDispatchService;

    public MaintenanceService(
        IRepository<MaintenanceRequest> repository,
        IRepository<Notification> notificationRepository,
        IRepository<FinancialRecord> financialRepository,
        INotificationDispatchService notificationDispatchService)
    {
        _repository = repository;
        _notificationRepository = notificationRepository;
        _financialRepository = financialRepository;
        _notificationDispatchService = notificationDispatchService;
    }

    public async Task<IEnumerable<MaintenanceRequestDto>> GetAllAsync(Guid condominiumId, string userRole, Guid userId, Guid? unitId)
    {
        var requests = await _repository.GetAllAsync();
        return requests
            .Where(r => CanUserViewMaintenance(r, condominiumId, userRole))
            .Select(MapToDto)
            .OrderByDescending(r => r.CreatedAt);
    }

    public async Task<PaginatedResponse<MaintenanceRequestDto>> GetPagedAsync(
        int page,
        int pageSize,
        Guid condominiumId,
        string userRole,
        Guid userId,
        Guid? unitId,
        string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        // Access rules mirror CanUserViewMaintenance: Admin and Resident may list every
        // request in the condominium (residents get read visibility over building-wide
        // maintenance). Write access remains gated per-request by CanUserAccessMaintenance.
        var isAdmin = string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase);
        var isResident = string.Equals(userRole, "Resident", StringComparison.OrdinalIgnoreCase);

        if (!isAdmin && !isResident)
        {
            return new PaginatedResponse<MaintenanceRequestDto>
            {
                Items = new List<MaintenanceRequestDto>(),
                Page = page,
                PageSize = pageSize,
                TotalItems = 0,
                TotalPages = 0
            };
        }

        var searchLower = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        var paged = await _repository.GetPagedAsync(
            page,
            pageSize,
            r => r.CondominiumId == condominiumId &&
                 (searchLower == null ||
                  r.Title.ToLower().Contains(searchLower) ||
                  (r.Description ?? "").ToLower().Contains(searchLower) ||
                  (r.Location ?? "").ToLower().Contains(searchLower)),
            r => r.CreatedAt,
            descending: true);

        return new PaginatedResponse<MaintenanceRequestDto>
        {
            Items = paged.Items.Select(MapToDto).ToList(),
            Page = paged.Page,
            PageSize = paged.PageSize,
            TotalItems = paged.TotalItems,
            TotalPages = paged.TotalPages
        };
    }

    public async Task<MaintenanceRequestDto?> GetByIdAsync(Guid id, Guid condominiumId, string userRole, Guid userId, Guid? unitId)
    {
        var request = await _repository.GetByIdAsync(id);
        if (request == null) return null;
        if (!CanUserViewMaintenance(request, condominiumId, userRole)) return null;

        return MapToDto(request);
    }

    public async Task<MaintenanceRequestDto> CreateAsync(CreateMaintenanceRequest request)
    {
        var entity = new MaintenanceRequest
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            Priority = Enum.Parse<MaintenancePriority>(request.Priority),
            CondominiumId = request.CondominiumId,
            UnitId = request.UnitId,
            CreatedBy = request.CreatedBy,
            Photos = request.Photos,
            Location = request.Location,
            Status = MaintenanceStatus.Open,
            CreatedAt = DateTime.UtcNow
        };
        await _repository.AddAsync(entity);
        await _repository.SaveChangesAsync();
        
        // Create notification for administrators
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = "Novo Pedido de Manutenção",
            Message = $"Um novo pedido de manutenção foi criado: {request.Title}",
            Type = NotificationType.Alert,
            TargetRole = "Admin",
            CondominiumId = request.CondominiumId,
            SentAt = DateTime.UtcNow,
            IsRead = false
        };
        await _notificationRepository.AddAsync(notification);
        await _notificationRepository.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: true);
        
        return MapToDto(entity);
    }

    public async Task<MaintenanceRequestDto?> UpdateAsync(
        Guid id,
        UpdateMaintenanceRequest request,
        Guid condominiumId,
        string userRole,
        Guid userId,
        Guid? unitId)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return null;
        if (!CanUserAccessMaintenance(entity, condominiumId, userRole, userId, unitId)) return null;

        if (request.Status != null) entity.Status = ParseStatus(request.Status);
        if (request.Priority != null) entity.Priority = Enum.Parse<MaintenancePriority>(request.Priority);
        if (request.Description != null) entity.Description = request.Description;
        if (IsCompletedStatus(entity.Status)) entity.ResolvedAt = DateTime.UtcNow;
        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return MapToDto(entity);
    }

    public Task<MaintenanceRequestDto?> UpdateAsync(Guid id, UpdateMaintenanceRequest request)
    {
        return UpdateWithoutScopeAsync(id, request);
    }

    private async Task<MaintenanceRequestDto?> UpdateWithoutScopeAsync(Guid id, UpdateMaintenanceRequest request)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return null;

        if (request.Status != null) entity.Status = ParseStatus(request.Status);
        if (request.Priority != null) entity.Priority = Enum.Parse<MaintenancePriority>(request.Priority);
        if (request.Description != null) entity.Description = request.Description;
        if (IsCompletedStatus(entity.Status)) entity.ResolvedAt = DateTime.UtcNow;

        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return MapToDto(entity);
    }

    public async Task<MaintenanceRequestDto?> UpdateStatusAsync(
        Guid id,
        UpdateMaintenanceStatusRequest request,
        Guid condominiumId,
        string userRole,
        Guid userId,
        Guid? unitId)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return null;
        if (!CanUserAccessMaintenance(entity, condominiumId, userRole, userId, unitId)) return null;

        var nextStatus = ParseStatus(request.Status);
        ValidateStatusTransition(entity.Status, nextStatus);
        entity.Status = nextStatus;
        
        if (!string.IsNullOrEmpty(request.SupplierId))
        {
            entity.SupplierId = Guid.Parse(request.SupplierId);
        }
        
        if (!string.IsNullOrEmpty(request.AdminComments))
        {
            var timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            var newComment = $"[{timestamp}] {request.AdminComments}";
            entity.AdminComments = string.IsNullOrEmpty(entity.AdminComments) 
                ? newComment 
                : $"{entity.AdminComments}\n{newComment}";
        }
        
        // Handle expense information - always required when resolving
        if (IsCompletedStatus(entity.Status))
        {
            if (!request.ExpenseAmount.HasValue || request.ExpenseAmount.Value <= 0)
            {
                throw new InvalidOperationException("O custo da manutenção é obrigatório quando o estado é alterado para Concluído.");
            }
            
            entity.HasExpense = true;
            entity.ExpenseAmount = request.ExpenseAmount;
            
            if (!string.IsNullOrWhiteSpace(request.InvoiceDocumentId))
            {
                entity.InvoiceDocumentId = Guid.Parse(request.InvoiceDocumentId);
            }
        }
        else
        {
            entity.HasExpense = request.HasExpense;
            if (request.HasExpense)
            {
                if (!request.ExpenseAmount.HasValue || request.ExpenseAmount.Value <= 0)
                {
                    throw new InvalidOperationException("O valor da despesa é obrigatório e deve ser superior a 0.");
                }
                if (string.IsNullOrWhiteSpace(request.InvoiceDocumentId))
                {
                    throw new InvalidOperationException("A fatura é obrigatória quando existe despesa.");
                }

                entity.ExpenseAmount = request.ExpenseAmount;
                entity.InvoiceDocumentId = Guid.Parse(request.InvoiceDocumentId);
            }
            else
            {
                entity.ExpenseAmount = null;
                entity.InvoiceDocumentId = null;
            }
        }
        
        if (IsCompletedStatus(entity.Status))
        {
            entity.ResolvedAt = DateTime.UtcNow;
            
            // Create financial record if there is an expense
            if (entity.HasExpense && entity.ExpenseAmount.HasValue)
            {
                var financialRecord = new FinancialRecord
                {
                    Id = Guid.NewGuid(),
                    Type = FinancialType.Expense,
                    Amount = entity.ExpenseAmount.Value,
                    Description = $"Manuten\u00e7\u00e3o: {entity.Title}",
                    Date = DateTime.UtcNow,
                    FiscalYear = DateTime.UtcNow.Year,
                    Category = FinancialCategory.Maintenance,
                    CondominiumId = entity.CondominiumId,
                    ReceiptUrl = entity.InvoiceDocumentId.ToString()
                };
                
                await _financialRepository.AddAsync(financialRecord);
            }
        }
        
        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        if (entity.HasExpense && entity.ExpenseAmount.HasValue && IsCompletedStatus(entity.Status))
        {
            await _financialRepository.SaveChangesAsync();
        }
        
        return MapToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid condominiumId, string userRole, Guid userId, Guid? unitId)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return false;
        if (!CanUserAccessMaintenance(entity, condominiumId, userRole, userId, unitId)) return false;

        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return true;
    }

    private static MaintenanceStatus ParseStatus(string status)
    {
        if (string.Equals(status, "Resolved", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "Closed", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            return MaintenanceStatus.Completed;
        }

        return Enum.Parse<MaintenanceStatus>(status, ignoreCase: true);
    }

    private static bool IsCompletedStatus(MaintenanceStatus status)
    {
        return status == MaintenanceStatus.Completed || status == MaintenanceStatus.Closed;
    }

    private static void ValidateStatusTransition(MaintenanceStatus currentStatus, MaintenanceStatus nextStatus)
    {
        if (currentStatus == nextStatus)
        {
            return;
        }

        if (IsCompletedStatus(currentStatus))
        {
            throw new InvalidOperationException("Uma manutenção concluída não pode voltar a outros estados.");
        }

        if (currentStatus == MaintenanceStatus.InProgress && nextStatus == MaintenanceStatus.Open)
        {
            throw new InvalidOperationException("Uma manutenção em curso não pode voltar ao estado Aberto.");
        }
    }

    private static string ToDtoStatus(MaintenanceStatus status)
    {
        return IsCompletedStatus(status)
            ? nameof(MaintenanceStatus.Completed)
            : status.ToString();
    }

    private static bool CanUserViewMaintenance(
        MaintenanceRequest request,
        Guid condominiumId,
        string userRole)
    {
        if (!request.CondominiumId.Equals(condominiumId))
        {
            return false;
        }

        // Admins and residents share read visibility over every maintenance request in the
        // condominium; write operations stay gated by CanUserAccessMaintenance.
        return string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(userRole, "Resident", StringComparison.OrdinalIgnoreCase);
    }

    private static bool CanUserAccessMaintenance(
        MaintenanceRequest request,
        Guid condominiumId,
        string userRole,
        Guid userId,
        Guid? unitId)
    {
        if (!request.CondominiumId.Equals(condominiumId))
        {
            return false;
        }

        if (string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.Equals(userRole, "Resident", StringComparison.OrdinalIgnoreCase))
        {
            return request.CreatedBy == userId || (unitId.HasValue && request.UnitId == unitId.Value);
        }

        return false;
    }

    private static MaintenanceRequestDto MapToDto(MaintenanceRequest r) => new()
    {
        Id = r.Id,
        Title = r.Title,
        Description = r.Description,
        Status = ToDtoStatus(r.Status),
        Priority = r.Priority.ToString(),
        CondominiumId = r.CondominiumId,
        UnitId = r.UnitId,
        CreatedBy = r.CreatedBy,
        CreatedAt = r.CreatedAt,
        ResolvedAt = r.ResolvedAt,
        Photos = r.Photos,
        Location = r.Location,
        SupplierId = r.SupplierId,
        AdminComments = r.AdminComments,
        HasExpense = r.HasExpense,
        ExpenseAmount = r.ExpenseAmount,
        InvoiceDocumentId = r.InvoiceDocumentId
    };
}

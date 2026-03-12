using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Maintenance;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class MaintenanceService
{
    private readonly IRepository<MaintenanceRequest> _repository;
    private readonly IRepository<Notification> _notificationRepository;
    private readonly IRepository<FinancialRecord> _financialRepository;

    public MaintenanceService(
        IRepository<MaintenanceRequest> repository,
        IRepository<Notification> notificationRepository,
        IRepository<FinancialRecord> financialRepository)
    {
        _repository = repository;
        _notificationRepository = notificationRepository;
        _financialRepository = financialRepository;
    }

    public async Task<IEnumerable<MaintenanceRequestDto>> GetAllAsync()
    {
        var requests = await _repository.GetAllAsync();
        return requests.Select(MapToDto);
    }

    public async Task<PaginatedResponse<MaintenanceRequestDto>> GetPagedAsync(int page, int pageSize, string? search = null)
    {
        var requests = await _repository.GetAllAsync();
        var dtos = requests.Select(MapToDto).OrderByDescending(r => r.CreatedAt);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(r =>
                r.Title.ToLower().Contains(searchLower) ||
                (r.Description ?? "").ToLower().Contains(searchLower) ||
                (r.Location ?? "").ToLower().Contains(searchLower)
            ).OrderByDescending(r => r.CreatedAt);
        }
        
        return PaginationHelper.Paginate(dtos, page, pageSize);
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

    public async Task<MaintenanceRequestDto?> UpdateStatusAsync(Guid id, UpdateMaintenanceStatusRequest request)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return null;

        entity.Status = Enum.Parse<MaintenanceStatus>(request.Status);
        
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
        
        // Handle expense information
        entity.HasExpense = request.HasExpense;
        if (request.HasExpense)
        {
            // Validate required fields
            if (!request.ExpenseAmount.HasValue || request.ExpenseAmount.Value <= 0)
            {
                throw new InvalidOperationException("Expense amount is required and must be greater than 0 when maintenance has expense.");
            }
            if (string.IsNullOrWhiteSpace(request.InvoiceDocumentId))
            {
                throw new InvalidOperationException("Invoice document is required when maintenance has expense.");
            }
            
            entity.ExpenseAmount = request.ExpenseAmount;
            entity.InvoiceDocumentId = Guid.Parse(request.InvoiceDocumentId);
        }
        else
        {
            entity.ExpenseAmount = null;
            entity.InvoiceDocumentId = null;
        }
        
        if (entity.Status == MaintenanceStatus.Resolved)
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
        if (entity.HasExpense && entity.ExpenseAmount.HasValue && entity.Status == MaintenanceStatus.Resolved)
        {
            await _financialRepository.SaveChangesAsync();
        }
        
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

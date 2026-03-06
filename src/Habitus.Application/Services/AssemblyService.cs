using Habitus.Application.DTOs.Assemblies;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class AssemblyService
{
    private readonly IRepository<Assembly> _repository;
    private readonly IRepository<Notification> _notificationRepository;

    public AssemblyService(
        IRepository<Assembly> repository,
        IRepository<Notification> notificationRepository)
    {
        _repository = repository;
        _notificationRepository = notificationRepository;
    }

    public async Task<IEnumerable<AssemblyDto>> GetAllAsync()
    {
        var assemblies = (await _repository.GetAllAsync()).ToList();
        
        // Auto-update status for scheduled assemblies that should be in progress
        await UpdateScheduledAssembliesStatusAsync(assemblies);
        
        return assemblies.Select(MapToDto);
    }

    public async Task<PaginatedResponse<AssemblyDto>> GetPagedAsync(int page, int pageSize, string? search = null)
    {
        var assemblies = (await _repository.GetAllAsync()).ToList();
        
        // Auto-update status for scheduled assemblies that should be in progress
        await UpdateScheduledAssembliesStatusAsync(assemblies);
        
        var dtos = assemblies.Select(MapToDto).OrderByDescending(a => a.ScheduledAt);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(a =>
                a.Title.ToLower().Contains(searchLower) ||
                (a.Description ?? "").ToLower().Contains(searchLower) ||
                (a.Location ?? "").ToLower().Contains(searchLower)
            ).OrderByDescending(a => a.ScheduledAt);
        }
        
        return PaginationHelper.Paginate(dtos, page, pageSize);
    }

    public async Task<AssemblyDto?> GetByIdAsync(Guid id)
    {
        var assembly = await _repository.GetByIdAsync(id);
        if (assembly == null) return null;
        
        // Auto-update status if needed
        await UpdateStatusIfNeededAsync(assembly);
        
        return MapToDto(assembly);
    }

    public async Task<AssemblyDto> CreateAsync(CreateAssemblyRequest request)
    {
        Console.WriteLine($"[DEBUG CREATE] Received ScheduledAt: {request.ScheduledAt} (Kind: {request.ScheduledAt.Kind})");
        Console.WriteLine($"[DEBUG CREATE] Current UTC time: {DateTime.UtcNow}");
        
        var scheduledAtUtc = DateTime.SpecifyKind(request.ScheduledAt, DateTimeKind.Utc);
        Console.WriteLine($"[DEBUG CREATE] After SpecifyKind: {scheduledAtUtc} (Kind: {scheduledAtUtc.Kind})");
        
        var assembly = new Assembly
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            ScheduledAt = scheduledAtUtc,
            Location = request.Location,
            Status = AssemblyStatus.Scheduled,
            CondominiumId = request.CondominiumId,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(assembly);
        await _repository.SaveChangesAsync();

        // Criar notificação para todos os utilizadores do condomínio
        await CreateNotificationForCondominiumUsersAsync(
            request.CondominiumId,
            "Nova Assembleia Agendada",
            $"Foi agendada uma nova assembleia: {request.Title} para {request.ScheduledAt:dd/MM/yyyy HH:mm}"
        );

        return MapToDto(assembly);
    }

    public async Task<AssemblyDto?> UpdateAsync(Guid id, UpdateAssemblyRequest request)
    {
        var assembly = await _repository.GetByIdAsync(id);
        if (assembly == null) return null;

        if (request.Title != null) assembly.Title = request.Title;
        if (request.Description != null) assembly.Description = request.Description;
        if (request.ScheduledAt != null) assembly.ScheduledAt = DateTime.SpecifyKind(request.ScheduledAt.Value, DateTimeKind.Utc);
        if (request.Location != null) assembly.Location = request.Location;
        
        assembly.UpdatedAt = DateTime.UtcNow;

        _repository.Update(assembly);
        await _repository.SaveChangesAsync();

        // Criar notificação de atualização
        await CreateNotificationForCondominiumUsersAsync(
            assembly.CondominiumId,
            "Assembleia Atualizada",
            $"A assembleia '{assembly.Title}' foi atualizada."
        );

        return MapToDto(assembly);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var assembly = await _repository.GetByIdAsync(id);
        if (assembly == null) return false;

        _repository.Remove(assembly);
        await _repository.SaveChangesAsync();
        return true;
    }

    public async Task<AssemblyDto?> UpdateMinutesAsync(Guid id, UpdateMinutesRequest request)
    {
        var assembly = await _repository.GetByIdAsync(id);
        if (assembly == null) return null;

        assembly.Minutes = request.Minutes;
        assembly.Status = AssemblyStatus.Completed;
        assembly.UpdatedAt = DateTime.UtcNow;

        _repository.Update(assembly);
        await _repository.SaveChangesAsync();

        // Notificar que a assembleia foi concluída
        await CreateNotificationForCondominiumUsersAsync(
            assembly.CondominiumId,
            "Assembleia Concluída",
            $"A assembleia '{assembly.Title}' foi concluída. As atas já estão disponíveis."
        );

        return MapToDto(assembly);
    }

    public async Task<AssemblyDto?> UpdateMinutesDraftAsync(Guid id, UpdateMinutesRequest request)
    {
        var assembly = await _repository.GetByIdAsync(id);
        if (assembly == null) return null;

        // Apenas atualiza as atas sem mudar status ou enviar notificações
        assembly.Minutes = request.Minutes;
        assembly.UpdatedAt = DateTime.UtcNow;

        _repository.Update(assembly);
        await _repository.SaveChangesAsync();

        return MapToDto(assembly);
    }

    public async Task<AssemblyDto?> UpdateNotesAsync(Guid id, UpdateNotesRequest request)
    {
        var assembly = await _repository.GetByIdAsync(id);
        if (assembly == null) return null;

        assembly.Notes = request.Notes;
        assembly.UpdatedAt = DateTime.UtcNow;

        _repository.Update(assembly);
        await _repository.SaveChangesAsync();

        return MapToDto(assembly);
    }

    public async Task<AssemblyDto?> CancelAsync(Guid id, CancelAssemblyRequest request)
    {
        var assembly = await _repository.GetByIdAsync(id);
        if (assembly == null) return null;

        assembly.Status = AssemblyStatus.Cancelled;
        assembly.CancellationReason = request.CancellationReason;
        assembly.UpdatedAt = DateTime.UtcNow;

        _repository.Update(assembly);
        await _repository.SaveChangesAsync();

        // Notificar cancelamento
        await CreateNotificationForCondominiumUsersAsync(
            assembly.CondominiumId,
            "Assembleia Cancelada",
            $"A assembleia '{assembly.Title}' foi cancelada. Motivo: {request.CancellationReason}"
        );

        return MapToDto(assembly);
    }

    private async Task CreateNotificationForCondominiumUsersAsync(Guid condominiumId, string title, string message)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = title,
            Message = message,
            Type = NotificationType.Info,
            TargetRole = "", // Vazio = todos os utilizadores
            CondominiumId = condominiumId,
            IsRead = false,
            SentAt = DateTime.UtcNow
        };

        await _notificationRepository.AddAsync(notification);
        await _notificationRepository.SaveChangesAsync();
    }

    /// <summary>
    /// Auto-updates assembly status from Scheduled to InProgress if the scheduled time has passed
    /// </summary>
    private async Task UpdateStatusIfNeededAsync(Assembly assembly)
    {
        var now = DateTime.UtcNow;
        Console.WriteLine($"[DEBUG GetById] Assembly: {assembly.Title}");
        Console.WriteLine($"[DEBUG GetById] Status: {assembly.Status}");
        Console.WriteLine($"[DEBUG GetById] ScheduledAt: {assembly.ScheduledAt} (Kind: {assembly.ScheduledAt.Kind})");
        Console.WriteLine($"[DEBUG GetById] Now (UTC): {now}");
        Console.WriteLine($"[DEBUG GetById] Should update? {assembly.Status == AssemblyStatus.Scheduled && assembly.ScheduledAt <= now}");
        
        if (assembly.Status == AssemblyStatus.Scheduled && 
            assembly.ScheduledAt <= now)
        {
            Console.WriteLine($"[DEBUG GetById] ✅ Updating {assembly.Title} to InProgress");
            assembly.Status = AssemblyStatus.InProgress;
            assembly.UpdatedAt = DateTime.UtcNow;
            _repository.Update(assembly);
            await _repository.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Batch update for GetAllAsync to avoid multiple SaveChanges calls
    /// </summary>
    private async Task UpdateScheduledAssembliesStatusAsync(IEnumerable<Assembly> assemblies)
    {
        var now = DateTime.UtcNow;
        var needsUpdate = false;
        
        foreach (var assembly in assemblies)
        {
            // Debug: Log para verificar comparação
            Console.WriteLine($"[DEBUG] Assembly: {assembly.Title}");
            Console.WriteLine($"[DEBUG] Status: {assembly.Status}");
            Console.WriteLine($"[DEBUG] ScheduledAt: {assembly.ScheduledAt} (Kind: {assembly.ScheduledAt.Kind})");
            Console.WriteLine($"[DEBUG] Now (UTC): {now}");
            Console.WriteLine($"[DEBUG] Should update? {assembly.Status == AssemblyStatus.Scheduled && assembly.ScheduledAt <= now}");
            
            if (assembly.Status == AssemblyStatus.Scheduled && 
                assembly.ScheduledAt <= now)
            {
                Console.WriteLine($"[DEBUG] ✅ Updating {assembly.Title} to InProgress");
                assembly.Status = AssemblyStatus.InProgress;
                assembly.UpdatedAt = DateTime.UtcNow;
                _repository.Update(assembly);
                needsUpdate = true;
            }
        }
        
        if (needsUpdate)
        {
            Console.WriteLine($"[DEBUG] Saving changes to database...");
            await _repository.SaveChangesAsync();
        }
    }

    private static AssemblyDto MapToDto(Assembly a) => new()
    {
        Id = a.Id,
        Title = a.Title,
        Description = a.Description,
        ScheduledAt = a.ScheduledAt,
        Location = a.Location,
        Status = a.Status.ToString(),
        Minutes = a.Minutes,
        Notes = a.Notes,
        CancellationReason = a.CancellationReason,
        CreatedAt = a.CreatedAt,
        UpdatedAt = a.UpdatedAt,
        CondominiumId = a.CondominiumId
    };
}

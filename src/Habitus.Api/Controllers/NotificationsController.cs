using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/[controller]")]
[Authorize(Roles = "Admin,Resident")]
public class NotificationsController : ControllerBase
{
    public sealed class CreateNotificationRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public NotificationType Type { get; set; }
        public string TargetRole { get; set; } = string.Empty;
        public Guid? TargetUserId { get; set; }
        public Guid? CondominiumId { get; set; }
    }

    private readonly IRepository<Notification> _repository;
    private readonly IRepository<User> _userRepository;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatchService _notificationDispatchService;

    public NotificationsController(
        IRepository<Notification> repository,
        IRepository<User> userRepository,
        INotificationService notificationService,
        INotificationDispatchService notificationDispatchService)
    {
        _repository = repository;
        _userRepository = userRepository;
        _notificationService = notificationService;
        _notificationDispatchService = notificationDispatchService;
    }

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var userCondominiumId = User.FindFirstValue("CondominiumId");
        return Guid.TryParse(userCondominiumId, out var userCondominiumGuid) && userCondominiumGuid == condominiumId;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Resident";
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized("Invalid user scope.");
        
        var paginatedResult = await _notificationService.GetPagedAsync(page, pageSize, condominiumId, userRole, userId);
        return Ok(paginatedResult);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var result = await _notificationService.GetByIdAsync(id);
        if (result != null && result.CondominiumId != condominiumId) return NotFound();
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateNotificationRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (request.CondominiumId.HasValue && request.CondominiumId.Value != condominiumId)
            return BadRequest(new { message = "O condominiumId no corpo do pedido não coincide com o da rota." });

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "Título e mensagem são obrigatórios." });

        if (request.TargetUserId.HasValue)
        {
            var targetUser = await _userRepository.GetByIdAsync(request.TargetUserId.Value);
            if (targetUser == null || targetUser.CondominiumId != condominiumId)
                return BadRequest(new { message = "O utilizador alvo não pertence ao condomínio da rota." });

            if (targetUser.Role != UserRole.Resident)
                return BadRequest(new { message = "Notificações direcionadas só podem ter como alvo utilizadores Resident." });
        }

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Message = request.Message.Trim(),
            Type = request.Type,
            TargetRole = request.TargetRole?.Trim() ?? string.Empty,
            TargetUserId = request.TargetUserId,
            CondominiumId = condominiumId,
            SentAt = DateTime.UtcNow,
        };

        await _repository.AddAsync(notification);
        await _repository.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync([notification], sendExternalChannels: true);
        return CreatedAtAction(nameof(GetById), new { condominiumId, id = notification.Id }, notification);
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Resident";
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized("Invalid user scope.");

        await _notificationService.MarkAsReadAsync(id, condominiumId, userRole, userId);
        return Ok();
    }

    [HttpPut("mark-all-read")]
    public async Task<IActionResult> MarkAllRead([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Resident";
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized("Invalid user scope.");

        await _notificationService.MarkAllAsReadAsync(condominiumId, userRole, userId);
        return Ok();
    }

    [HttpDelete("clear-all")]
    public async Task<IActionResult> ClearAll([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        await _notificationService.DeleteAllAsync(condominiumId);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var entity = await _repository.GetByIdAsync(id);
        if (entity != null && entity.CondominiumId != condominiumId) return NotFound();
        if (entity == null) return NotFound();
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return NoContent();
    }
}

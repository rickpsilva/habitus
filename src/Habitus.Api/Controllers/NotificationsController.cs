using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly IRepository<Notification> _repository;
    public NotificationsController(IRepository<Notification> repository) => _repository = repository;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _repository.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _repository.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] Notification notification)
    {
        notification.Id = Guid.NewGuid();
        notification.SentAt = DateTime.UtcNow;
        await _repository.AddAsync(notification);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = notification.Id }, notification);
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return NotFound();
        entity.IsRead = true;
        _repository.Update(entity);
        await _repository.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return NotFound();
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return NoContent();
    }
}

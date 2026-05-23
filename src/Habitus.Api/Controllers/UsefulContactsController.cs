using Habitus.Application.Interfaces;
using Habitus.Api.Middleware;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/useful-contacts")]
[Authorize(Roles = "Admin,Resident")]
[RequireFeature("useful_contacts")]
public class UsefulContactsController : ControllerBase
{
    public sealed class CreateUsefulContactRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public ContactCategory Category { get; set; }
        public Guid? CondominiumId { get; set; }
    }

    public sealed class UpdateUsefulContactRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public ContactCategory Category { get; set; }
    }

    private readonly IRepository<UsefulContact> _repository;
    public UsefulContactsController(IRepository<UsefulContact> repository) => _repository = repository;

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
        return Guid.TryParse(userCondominiumId, out var userCondominiumGuid) && userCondominiumGuid == condominiumId;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var contacts = await _repository.FindAsync(c => c.CondominiumId == condominiumId);
        return Ok(contacts);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var result = await _repository.GetByIdAsync(id);
        if (result != null && result.CondominiumId != condominiumId) return NotFound();
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateUsefulContactRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (request.CondominiumId.HasValue && request.CondominiumId.Value != condominiumId)
            return BadRequest(new { message = "O condominiumId no corpo do pedido não coincide com o da rota." });

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
            return BadRequest(new { message = "Nome e telefone são obrigatórios." });

        var contact = new UsefulContact
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Name = request.Name.Trim(),
            Phone = request.Phone.Trim(),
            Category = request.Category,
        };

        await _repository.AddAsync(contact);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { condominiumId, id = contact.Id }, contact);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateUsefulContactRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var existing = await _repository.GetByIdAsync(id);
        if (existing == null || existing.CondominiumId != condominiumId) return NotFound();

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
            return BadRequest(new { message = "Nome e telefone são obrigatórios." });

        existing.Name = request.Name.Trim();
        existing.Phone = request.Phone.Trim();
        existing.Category = request.Category;
        _repository.Update(existing);
        await _repository.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var entity = await _repository.GetByIdAsync(id);
        if (entity == null || entity.CondominiumId != condominiumId) return NotFound();
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return NoContent();
    }
}

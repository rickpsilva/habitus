using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.SharedSpaces;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/shared-spaces")]
[Authorize]
public class SharedSpacesController : ControllerBase
{
    private readonly IRepository<SharedSpace> _repository;
    public SharedSpacesController(IRepository<SharedSpace> repository) => _repository = repository;

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        if (role == "Manager") return true;

        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
        return Guid.TryParse(userCondominiumId, out var userCondominiumGuid) && userCondominiumGuid == condominiumId;
    }

    private static SharedSpaceDto MapToDto(SharedSpace space) => new()
    {
        Id = space.Id,
        Name = space.Name,
        Description = space.Description,
        Capacity = space.Capacity,
        CondominiumId = space.CondominiumId,
        Rules = space.Rules,
        ReservationFee = space.ReservationFee,
        Color = space.Color
    };

    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var spaces = await _repository.FindAsync(s => s.CondominiumId == condominiumId);
        var dtos = spaces.Select(MapToDto);
        return Ok(dtos);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromRoute] Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var searchLower = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        var paged = await _repository.GetPagedAsync(
            page,
            pageSize,
            s => s.CondominiumId == condominiumId &&
                 (searchLower == null ||
                  s.Name.ToLower().Contains(searchLower) ||
                  s.Description.ToLower().Contains(searchLower)),
            s => s.Name,
            descending: false);

        return Ok(new PaginatedResponse<SharedSpaceDto>
        {
            Items = paged.Items.Select(MapToDto).ToList(),
            Page = paged.Page,
            PageSize = paged.PageSize,
            TotalItems = paged.TotalItems,
            TotalPages = paged.TotalPages
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var space = await _repository.GetByIdAsync(id);
        if (space == null || space.CondominiumId != condominiumId) return NotFound();

        return Ok(MapToDto(space));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateSharedSpaceRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (request.CondominiumId != Guid.Empty && request.CondominiumId != condominiumId)
            return BadRequest(new { message = "O condominiumId no corpo do pedido não coincide com o da rota." });

        var space = new SharedSpace
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            Capacity = request.Capacity,
            CondominiumId = condominiumId,
            Rules = request.Rules,
            ReservationFee = request.ReservationFee,
            Color = request.Color
        };
        
        await _repository.AddAsync(space);
        await _repository.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { condominiumId, id = space.Id }, MapToDto(space));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateSharedSpaceRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var existing = await _repository.GetByIdAsync(id);
        if (existing == null || existing.CondominiumId != condominiumId) return NotFound();
        
        existing.Name = request.Name;
        existing.Description = request.Description;
        existing.Capacity = request.Capacity;
        existing.Rules = request.Rules;
        existing.ReservationFee = request.ReservationFee;
        existing.Color = request.Color;
        
        _repository.Update(existing);
        await _repository.SaveChangesAsync();

        return Ok(MapToDto(existing));
    }

    [HttpDelete("{id}")]
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

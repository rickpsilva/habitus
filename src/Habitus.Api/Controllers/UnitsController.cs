using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Units;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/units")]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly IRepository<Unit> _repository;
    public UnitsController(IRepository<Unit> repository) => _repository = repository;

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll() => Ok(await _repository.GetAllAsync());

    [HttpGet("paged")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        
        var units = await _repository.GetAllAsync();
        var ordered = units.OrderBy(u => u.Number);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            ordered = ordered.Where(u =>
                u.Number.ToLower().Contains(searchLower) ||
                (u.ApartmentNumber ?? "").ToLower().Contains(searchLower)
            ).OrderBy(u => u.Number);
        }
        
        return Ok(PaginationHelper.Paginate(ordered, page, pageSize));
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _repository.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateUnitRequest request)
    {
        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            CondominiumId = request.CondominiumId,
            Number = request.Number,
            Floor = request.Floor,
            Type = request.Type,
            ApartmentNumber = request.ApartmentNumber,
            Permillage = request.Permillage
        };
        
        await _repository.AddAsync(unit);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = unit.Id }, unit);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateUnitRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) return NotFound();
        
        existing.CondominiumId = request.CondominiumId;
        existing.Number = request.Number;
        existing.Floor = request.Floor;
        existing.Type = request.Type;
        existing.ApartmentNumber = request.ApartmentNumber;
        existing.Permillage = request.Permillage;
        
        _repository.Update(existing);
        await _repository.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return NotFound();
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return NoContent();
    }
}

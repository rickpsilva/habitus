using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.SharedSpaces;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/shared-spaces")]
[Authorize]
public class SharedSpacesController : ControllerBase
{
    private readonly IRepository<SharedSpace> _repository;
    public SharedSpacesController(IRepository<SharedSpace> repository) => _repository = repository;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var spaces = await _repository.GetAllAsync();
        var dtos = spaces.Select(s => new SharedSpaceDto
        {
            Id = s.Id,
            Name = s.Name,
            Description = s.Description,
            Capacity = s.Capacity,
            CondominiumId = s.CondominiumId,
            Rules = s.Rules
        });
        return Ok(dtos);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        
        var spaces = await _repository.GetAllAsync();
        var dtos = spaces.Select(s => new SharedSpaceDto
        {
            Id = s.Id,
            Name = s.Name,
            Description = s.Description,
            Capacity = s.Capacity,
            CondominiumId = s.CondominiumId,
            Rules = s.Rules
        }).OrderBy(s => s.Name);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(s =>
                s.Name.ToLower().Contains(searchLower) ||
                (s.Description ?? "").ToLower().Contains(searchLower)
            ).OrderBy(s => s.Name);
        }
        
        return Ok(PaginationHelper.Paginate(dtos, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var space = await _repository.GetByIdAsync(id);
        if (space == null) return NotFound();
        
        var dto = new SharedSpaceDto
        {
            Id = space.Id,
            Name = space.Name,
            Description = space.Description,
            Capacity = space.Capacity,
            CondominiumId = space.CondominiumId,
            Rules = space.Rules
        };
        return Ok(dto);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateSharedSpaceRequest request)
    {
        var space = new SharedSpace
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            Capacity = request.Capacity,
            CondominiumId = request.CondominiumId,
            Rules = request.Rules
        };
        
        await _repository.AddAsync(space);
        await _repository.SaveChangesAsync();
        
        var dto = new SharedSpaceDto
        {
            Id = space.Id,
            Name = space.Name,
            Description = space.Description,
            Capacity = space.Capacity,
            CondominiumId = space.CondominiumId,
            Rules = space.Rules
        };
        
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSharedSpaceRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) return NotFound();
        
        existing.Name = request.Name;
        existing.Description = request.Description;
        existing.Capacity = request.Capacity;
        existing.Rules = request.Rules;
        
        _repository.Update(existing);
        await _repository.SaveChangesAsync();
        
        var dto = new SharedSpaceDto
        {
            Id = existing.Id,
            Name = existing.Name,
            Description = existing.Description,
            Capacity = existing.Capacity,
            CondominiumId = existing.CondominiumId,
            Rules = existing.Rules
        };
        
        return Ok(dto);
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

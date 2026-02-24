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
    public async Task<IActionResult> GetAll() => Ok(await _repository.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _repository.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] SharedSpace space)
    {
        space.Id = Guid.NewGuid();
        await _repository.AddAsync(space);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = space.Id }, space);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] SharedSpace space)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) return NotFound();
        existing.Name = space.Name;
        existing.Description = space.Description;
        existing.Capacity = space.Capacity;
        existing.Rules = space.Rules;
        _repository.Update(existing);
        await _repository.SaveChangesAsync();
        return Ok(existing);
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

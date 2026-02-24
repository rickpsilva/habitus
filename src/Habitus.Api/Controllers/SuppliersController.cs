using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/suppliers")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly IRepository<Supplier> _repository;
    public SuppliersController(IRepository<Supplier> repository) => _repository = repository;

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
    public async Task<IActionResult> Create([FromBody] Supplier supplier)
    {
        supplier.Id = Guid.NewGuid();
        await _repository.AddAsync(supplier);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, supplier);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] Supplier supplier)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) return NotFound();
        existing.Name = supplier.Name;
        existing.Contact = supplier.Contact;
        existing.Email = supplier.Email;
        existing.Phone = supplier.Phone;
        existing.Specialty = supplier.Specialty;
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

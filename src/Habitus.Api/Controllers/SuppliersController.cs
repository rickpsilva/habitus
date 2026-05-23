using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Suppliers;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/[controller]")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly IRepository<Supplier> _repository;
    public SuppliersController(IRepository<Supplier> repository) => _repository = repository;

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        if (role == "Manager") return true;

        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
        return Guid.TryParse(userCondominiumId, out var userCondominiumGuid) && userCondominiumGuid == condominiumId;
    }

    private static SupplierDto MapToDto(Supplier supplier) => new()
    {
        Id = supplier.Id.ToString(),
        Name = supplier.Name,
        Contact = supplier.Contact,
        Email = supplier.Email,
        Phone = supplier.Phone,
        Address = supplier.Address,
        Specialty = supplier.Specialty,
        IsActive = supplier.IsActive,
        CondominiumId = supplier.CondominiumId.ToString()
    };

    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var suppliers = await _repository.FindAsync(s => s.CondominiumId == condominiumId);
        var dtos = suppliers.Select(MapToDto);
        return Ok(dtos);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromRoute] Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        
        var suppliers = await _repository.FindAsync(s => s.CondominiumId == condominiumId);
        var dtos = suppliers.Select(MapToDto).OrderBy(s => s.Name);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(s =>
                s.Name.ToLower().Contains(searchLower) ||
                (s.Contact ?? "").ToLower().Contains(searchLower) ||
                (s.Email ?? "").ToLower().Contains(searchLower) ||
                (s.Specialty ?? "").ToLower().Contains(searchLower)
            ).OrderBy(s => s.Name);
        }
        
        return Ok(PaginationHelper.Paginate(dtos, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var supplier = await _repository.GetByIdAsync(id);
        if (supplier == null || supplier.CondominiumId != condominiumId) return NotFound();

        return Ok(MapToDto(supplier));
    }

    [HttpPost]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateSupplierRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (!string.IsNullOrWhiteSpace(request.CondominiumId)
            && Guid.TryParse(request.CondominiumId, out var requestCondominiumId)
            && requestCondominiumId != condominiumId)
        {
            return BadRequest(new { message = "O condominiumId no corpo do pedido não coincide com o da rota." });
        }

        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Contact = request.Contact,
            Email = request.Email,
            Phone = request.Phone,
            Address = request.Address,
            Specialty = request.Specialty,
            CondominiumId = condominiumId,
            IsActive = true
        };
        
        await _repository.AddAsync(supplier);
        await _repository.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { condominiumId, id = supplier.Id }, MapToDto(supplier));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateSupplierRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var existing = await _repository.GetByIdAsync(id);
        if (existing == null || existing.CondominiumId != condominiumId) return NotFound();
        
        existing.Name = request.Name;
        existing.Contact = request.Contact;
        existing.Email = request.Email;
        existing.Phone = request.Phone;
        existing.Address = request.Address;
        existing.Specialty = request.Specialty;
        existing.IsActive = request.IsActive;
        
        _repository.Update(existing);
        await _repository.SaveChangesAsync();

        return Ok(MapToDto(existing));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Manager,Admin")]
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

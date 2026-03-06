using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Suppliers;
using Habitus.Application.Helpers;
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
    public async Task<IActionResult> GetAll()
    {
        var suppliers = await _repository.GetAllAsync();
        var dtos = suppliers.Select(s => new SupplierDto
        {
            Id = s.Id.ToString(),
            Name = s.Name,
            Contact = s.Contact,
            Email = s.Email,
            Phone = s.Phone,
            Address = s.Address,
            Specialty = s.Specialty,
            IsActive = s.IsActive,
            CondominiumId = s.CondominiumId.ToString()
        });
        return Ok(dtos);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        
        var suppliers = await _repository.GetAllAsync();
        var dtos = suppliers.Select(s => new SupplierDto
        {
            Id = s.Id.ToString(),
            Name = s.Name,
            Contact = s.Contact,
            Email = s.Email,
            Phone = s.Phone,
            Address = s.Address,
            Specialty = s.Specialty,
            IsActive = s.IsActive,
            CondominiumId = s.CondominiumId.ToString()
        }).OrderBy(s => s.Name);
        
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
    public async Task<IActionResult> GetById(Guid id)
    {
        var supplier = await _repository.GetByIdAsync(id);
        if (supplier == null) return NotFound();
        
        var dto = new SupplierDto
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
        return Ok(dto);
    }

    [HttpPost]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateSupplierRequest request)
    {
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Contact = request.Contact,
            Email = request.Email,
            Phone = request.Phone,
            Address = request.Address,
            Specialty = request.Specialty,
            CondominiumId = Guid.Parse(request.CondominiumId),
            IsActive = true
        };
        
        await _repository.AddAsync(supplier);
        await _repository.SaveChangesAsync();
        
        var dto = new SupplierDto
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
        
        return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, dto);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSupplierRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) return NotFound();
        
        existing.Name = request.Name;
        existing.Contact = request.Contact;
        existing.Email = request.Email;
        existing.Phone = request.Phone;
        existing.Address = request.Address;
        existing.Specialty = request.Specialty;
        existing.IsActive = request.IsActive;
        
        _repository.Update(existing);
        await _repository.SaveChangesAsync();
        
        var dto = new SupplierDto
        {
            Id = existing.Id.ToString(),
            Name = existing.Name,
            Contact = existing.Contact,
            Email = existing.Email,
            Phone = existing.Phone,
            Address = existing.Address,
            Specialty = existing.Specialty,
            IsActive = existing.IsActive,
            CondominiumId = existing.CondominiumId.ToString()
        };
        
        return Ok(dto);
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

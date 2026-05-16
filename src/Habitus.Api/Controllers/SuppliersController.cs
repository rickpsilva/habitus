using Habitus.Application.Services;
using Habitus.Application.DTOs.Suppliers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/suppliers")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly SupplierService _service;

    public SuppliersController(SupplierService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var condominiumScope = GetCondominiumScopeForRead();
            if (condominiumScope == Guid.Empty)
                return Forbid();

            var suppliers = await _service.GetAllAsync(condominiumScope == null ? null : condominiumScope.Value);
            return Ok(suppliers);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        try
        {
            var condominiumScope = GetCondominiumScopeForRead();
            if (condominiumScope == Guid.Empty)
                return Forbid();

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 10;

            var result = await _service.GetPagedAsync(page, pageSize, search, condominiumScope == null ? null : condominiumScope.Value);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var condominiumScope = GetCondominiumScopeForRead();
            if (condominiumScope == Guid.Empty)
                return Forbid();

            var supplier = await _service.GetByIdAsync(id);
            if (supplier != null && condominiumScope.HasValue && supplier.CondominiumId != condominiumScope.Value.ToString())
                return Forbid();

            return supplier == null ? NotFound() : Ok(supplier);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateSupplierRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var supplier = await _service.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, supplier);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSupplierRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var supplier = await _service.UpdateAsync(id, request);
            return supplier == null ? NotFound() : Ok(supplier);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            var deleted = await _service.DeleteAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    private Guid? GetCondominiumScopeForRead()
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase))
            return null;

        var condominiumIdClaim = User.FindFirstValue("CondominiumId");
        if (!Guid.TryParse(condominiumIdClaim, out var condominiumId))
            return Guid.Empty;

        return condominiumId;
    }
}

using Habitus.Application.Services;
using Habitus.Application.DTOs.Suppliers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/suppliers")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly SupplierService _service;

    public SuppliersController(SupplierService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid condominiumId)
    {
        try
        {
            if (!CanAccessCondominium(condominiumId))
                return Forbid();

            var suppliers = await _service.GetAllAsync(condominiumId);
            return Ok(suppliers);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged(Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        try
        {
            if (!CanAccessCondominium(condominiumId))
                return Forbid();

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 10;

            var result = await _service.GetPagedAsync(page, pageSize, search, condominiumId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid condominiumId, Guid id)
    {
        try
        {
            if (!CanAccessCondominium(condominiumId))
                return Forbid();

            var supplier = await _service.GetByIdAsync(id);
            if (supplier != null && supplier.CondominiumId != condominiumId.ToString())
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
    public async Task<IActionResult> Create(Guid condominiumId, [FromBody] CreateSupplierRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (!CanAccessCondominium(condominiumId))
                return Forbid();

            if (!Guid.TryParse(request.CondominiumId, out var requestCondominiumId) || requestCondominiumId != condominiumId)
                return BadRequest(new { message = "CondominiumId in body must match route condominiumId." });

            var supplier = await _service.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { condominiumId, id = supplier.Id }, supplier);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Update(Guid condominiumId, Guid id, [FromBody] UpdateSupplierRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (!CanAccessCondominium(condominiumId))
                return Forbid();

            var existing = await _service.GetByIdAsync(id);
            if (existing == null)
                return NotFound();

            if (existing.CondominiumId != condominiumId.ToString())
                return Forbid();

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
    public async Task<IActionResult> Delete(Guid condominiumId, Guid id)
    {
        try
        {
            if (!CanAccessCondominium(condominiumId))
                return Forbid();

            var existing = await _service.GetByIdAsync(id);
            if (existing == null)
                return NotFound();

            if (existing.CondominiumId != condominiumId.ToString())
                return Forbid();

            var deleted = await _service.DeleteAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase))
            return true;

        var condominiumIdClaim = User.FindFirstValue("CondominiumId");
        if (!Guid.TryParse(condominiumIdClaim, out var userCondominiumId))
            return false;

        return userCondominiumId == condominiumId;
    }
}

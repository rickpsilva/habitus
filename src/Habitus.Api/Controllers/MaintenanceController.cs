using Habitus.Application.DTOs.Maintenance;
using Habitus.Application.Services;
using Habitus.Api.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/maintenance")]
[Authorize(Roles = "Admin,Resident")]
[RequireFeature("maintenance")]
public class MaintenanceController : ControllerBase
{
    private readonly MaintenanceService _service;

    public MaintenanceController(MaintenanceService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!TryGetScope(condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Forbid();
        }

        return Ok(await _service.GetAllAsync(condominiumId, userRole, userId, unitId));
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromRoute] Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!TryGetScope(condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Forbid();
        }

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        return Ok(await _service.GetPagedAsync(page, pageSize, condominiumId, userRole, userId, unitId, search));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!TryGetScope(condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Forbid();
        }

        var result = await _service.GetByIdAsync(id, condominiumId, userRole, userId, unitId);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateMaintenanceRequest request)
    {
        if (!TryGetScope(condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Forbid();
        }

        if (request.CondominiumId != condominiumId)
        {
            return Forbid();
        }

        if (string.Equals(userRole, "Resident", StringComparison.OrdinalIgnoreCase))
        {
            if (request.CreatedBy != userId) return Forbid();
            if (unitId.HasValue && request.UnitId != unitId.Value) return Forbid();
        }

        var result = await _service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { condominiumId, id = result.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateMaintenanceRequest request)
    {
        if (!TryGetScope(condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Forbid();
        }

        var result = await _service.UpdateAsync(id, request, condominiumId, userRole, userId, unitId);
        return result == null ? NotFound() : Ok(result);
    }
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<MaintenanceRequestDto>> UpdateStatus([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateMaintenanceStatusRequest request)
    {
        if (!TryGetScope(condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Forbid();
        }

        var result = await _service.UpdateStatusAsync(id, request, condominiumId, userRole, userId, unitId);
        return result == null ? NotFound() : Ok(result);
    }
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!TryGetScope(condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Forbid();
        }

        var success = await _service.DeleteAsync(id, condominiumId, userRole, userId, unitId);
        return success ? NoContent() : NotFound();
    }

    private bool TryGetScope(Guid routeCondominiumId, out string userRole, out Guid userId, out Guid? unitId)
    {
        userId = Guid.Empty;
        userRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        unitId = null;

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var condominiumClaim = User.FindFirstValue("CondominiumId");
        var unitClaim = User.FindFirstValue("UnitId");

        var valid = Guid.TryParse(userIdClaim, out userId);

        if (!valid) return false;

        if (!Guid.TryParse(condominiumClaim, out var claimCondominiumId))
        {
            return false;
        }

        if (claimCondominiumId != routeCondominiumId)
        {
            return false;
        }

        if (Guid.TryParse(unitClaim, out var parsedUnitId))
        {
            unitId = parsedUnitId;
        }

        return true;
    }
}

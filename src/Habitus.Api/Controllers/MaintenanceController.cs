using Habitus.Application.DTOs.Maintenance;
using Habitus.Application.Services;
using Habitus.Api.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/maintenance")]
[Authorize(Roles = "Admin,Resident")]
[RequireFeature("maintenance")]
public class MaintenanceController : ControllerBase
{
    private readonly MaintenanceService _service;

    public MaintenanceController(MaintenanceService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!TryGetScope(out var condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Unauthorized("User scope is invalid.");
        }

        return Ok(await _service.GetAllAsync(condominiumId, userRole, userId, unitId));
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!TryGetScope(out var condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Unauthorized("User scope is invalid.");
        }

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        return Ok(await _service.GetPagedAsync(page, pageSize, condominiumId, userRole, userId, unitId, search));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetScope(out var condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Unauthorized("User scope is invalid.");
        }

        var result = await _service.GetByIdAsync(id, condominiumId, userRole, userId, unitId);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMaintenanceRequest request)
    {
        if (!TryGetScope(out var condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Unauthorized("User scope is invalid.");
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
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateMaintenanceRequest request)
    {
        if (!TryGetScope(out var condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Unauthorized("User scope is invalid.");
        }

        var result = await _service.UpdateAsync(id, request, condominiumId, userRole, userId, unitId);
        return result == null ? NotFound() : Ok(result);
    }
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<MaintenanceRequestDto>> UpdateStatus(Guid id, [FromBody] UpdateMaintenanceStatusRequest request)
    {
        if (!TryGetScope(out var condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Unauthorized("User scope is invalid.");
        }

        var result = await _service.UpdateStatusAsync(id, request, condominiumId, userRole, userId, unitId);
        return result == null ? NotFound() : Ok(result);
    }
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetScope(out var condominiumId, out var userRole, out var userId, out var unitId))
        {
            return Unauthorized("User scope is invalid.");
        }

        var success = await _service.DeleteAsync(id, condominiumId, userRole, userId, unitId);
        return success ? NoContent() : NotFound();
    }

    private bool TryGetScope(out Guid condominiumId, out string userRole, out Guid userId, out Guid? unitId)
    {
        condominiumId = Guid.Empty;
        userId = Guid.Empty;
        userRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        unitId = null;

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var condominiumClaim = User.FindFirstValue("CondominiumId");
        var unitClaim = User.FindFirstValue("UnitId");

        var valid = Guid.TryParse(userIdClaim, out userId)
            && Guid.TryParse(condominiumClaim, out condominiumId);

        if (!valid) return false;

        if (Guid.TryParse(unitClaim, out var parsedUnitId))
        {
            unitId = parsedUnitId;
        }

        return true;
    }
}

using Habitus.Application.DTOs.Assemblies;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Api.Middleware;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/assemblies")]
[Authorize(Roles = "Admin,Resident")]
[RequireFeature("assemblies")]
public class AssembliesController : ControllerBase
{
    private readonly AssemblyService _service;
    private readonly IRepository<AssemblyAttendance> _attendanceRepository;
    private readonly IRepository<AssemblyDecision> _decisionRepository;

    public AssembliesController(
        AssemblyService service,
        IRepository<AssemblyAttendance> attendanceRepository,
        IRepository<AssemblyDecision> decisionRepository)
    {
        _service = service;
        _attendanceRepository = attendanceRepository;
        _decisionRepository = decisionRepository;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AssemblyDto>>> GetAll([FromRoute] Guid condominiumId)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        var result = await _service.GetAllAsync(condominiumId, userRole);
        return Ok(result);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromRoute] Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        var result = await _service.GetPagedAsync(page, pageSize, condominiumId, userRole, search);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AssemblyDto>> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        var result = await _service.GetByIdAsync(id, condominiumId, userRole);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> Create([FromRoute] Guid condominiumId, [FromBody] CreateAssemblyRequest request)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        if (request.CondominiumId != condominiumId)
            return Forbid();

        var result = await _service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { condominiumId, id = result.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateAssemblyRequest request)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        var result = await _service.UpdateAsync(id, request, condominiumId, userRole);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/minutes")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> UpdateMinutes([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateMinutesRequest request)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        var result = await _service.UpdateMinutesAsync(id, request, condominiumId, userRole);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/draft-minutes")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> UpdateMinutesDraft([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateMinutesRequest request)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        var result = await _service.UpdateMinutesDraftAsync(id, request, condominiumId, userRole);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/notes")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> UpdateNotes([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateNotesRequest request)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        var result = await _service.UpdateNotesAsync(id, request, condominiumId, userRole);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/cancel")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> Cancel([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] CancelAssemblyRequest request)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        var result = await _service.CancelAsync(id, request, condominiumId, userRole);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        var deleted = await _service.DeleteAsync(id, condominiumId, userRole);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id}/attendance")]
    public async Task<IActionResult> AddAttendance([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] AssemblyAttendance attendance)
    {
        if (!TryGetScope(condominiumId, out _))
            return Forbid();

        // Validate that the assembly being attended belongs to the user's condominium
        var assembly = await _service.GetByIdAsync(id, condominiumId, "Admin") 
                    ?? await _service.GetByIdAsync(id, condominiumId, "Resident");
        if (assembly == null) return NotFound();

        attendance.Id = Guid.NewGuid();
        attendance.AssemblyId = id;
        attendance.ConfirmedAt = DateTime.UtcNow;
        await _attendanceRepository.AddAsync(attendance);
        await _attendanceRepository.SaveChangesAsync();
        return Ok(attendance);
    }

    [HttpPost("{id}/decisions")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddDecision([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] AssemblyDecision decision)
    {
        if (!TryGetScope(condominiumId, out var userRole))
            return Forbid();

        var assembly = await _service.GetByIdAsync(id, condominiumId, userRole);
        if (assembly == null) return NotFound();

        decision.Id = Guid.NewGuid();
        decision.AssemblyId = id;
        decision.DecidedAt = DateTime.UtcNow;
        await _decisionRepository.AddAsync(decision);
        await _decisionRepository.SaveChangesAsync();
        return Ok(decision);
    }

    private bool TryGetScope(Guid routeCondominiumId, out string userRole)
    {
        userRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

        var condominiumClaim = User.FindFirstValue("CondominiumId");
        return Guid.TryParse(condominiumClaim, out var claimCondominiumId)
            && claimCondominiumId == routeCondominiumId;
    }
}

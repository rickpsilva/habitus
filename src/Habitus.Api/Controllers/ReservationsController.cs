using Habitus.Application.DTOs.Reservations;
using Habitus.Application.Services;
using Habitus.Api.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/[controller]")]
[Authorize(Roles = "Admin,Resident")]
[RequireFeature("reservations")]
public class ReservationsController : ControllerBase
{
    private readonly ReservationService _service;

    public ReservationsController(ReservationService service) => _service = service;

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var userCondominiumClaim = User.FindFirstValue("CondominiumId");
        return Guid.TryParse(userCondominiumClaim, out var userCondominiumId) && userCondominiumId == condominiumId;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        return Ok(await _service.GetAllAsync(condominiumId));
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromRoute] Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        return Ok(await _service.GetPagedAsync(page, pageSize, condominiumId, search));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var result = await _service.GetByIdAsync(id, condominiumId);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateReservationRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var (dto, error) = await _service.CreateAsync(condominiumId, request);
        if (error != null) return Conflict(error);
        return CreatedAtAction(nameof(GetById), new { condominiumId, id = dto!.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateReservationRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var existing = await _service.GetByIdAsync(id, condominiumId);
        if (existing == null) return NotFound();
        var (dto, error) = await _service.UpdateAsync(id, condominiumId, request);
        if (error != null) return error.Contains("not found") ? NotFound(error) : Conflict(error);
        return Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var success = await _service.DeleteAsync(id, condominiumId);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var (dto, error) = await _service.ApproveAsync(id, request, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var (dto, error) = await _service.RejectAsync(id, request, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id:guid}/request-cancellation")]
    public async Task<IActionResult> RequestCancellation([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var (dto, error) = await _service.RequestCancellationAsync(id, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id:guid}/approve-cancellation")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ApproveCancellation([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var (dto, error) = await _service.ApproveCancellationAsync(id, request, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id:guid}/reject-cancellation")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectCancellation([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var (dto, error) = await _service.RejectCancellationAsync(id, request, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }
}

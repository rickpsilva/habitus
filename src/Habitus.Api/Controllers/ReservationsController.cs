using Habitus.Application.DTOs.Reservations;
using Habitus.Application.Services;
using Habitus.Api.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/reservations")]
[Authorize(Roles = "Admin,Resident")]
[RequireFeature("reservations")]
public class ReservationsController : ControllerBase
{
    private readonly ReservationService _service;

    public ReservationsController(ReservationService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        return Ok(await _service.GetAllAsync(condominiumId));
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        return Ok(await _service.GetPagedAsync(page, pageSize, condominiumId, search));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        var result = await _service.GetByIdAsync(id, condominiumId);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReservationRequest request)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        var (dto, error) = await _service.CreateAsync(request, condominiumId);
        if (error != null) return Conflict(error);
        return CreatedAtAction(nameof(GetById), new { id = dto!.Id }, dto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReservationRequest request)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        var existing = await _service.GetByIdAsync(id, condominiumId);
        if (existing == null) return NotFound();
        var (dto, error) = await _service.UpdateAsync(id, request, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : Conflict(error);
        return Ok(dto);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        var success = await _service.DeleteAsync(id, condominiumId);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        var (dto, error) = await _service.ApproveAsync(id, request, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        var (dto, error) = await _service.RejectAsync(id, request, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id}/request-cancellation")]
    public async Task<IActionResult> RequestCancellation(Guid id)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        var (dto, error) = await _service.RequestCancellationAsync(id, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id}/approve-cancellation")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ApproveCancellation(Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        var (dto, error) = await _service.ApproveCancellationAsync(id, request, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id}/reject-cancellation")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectCancellation(Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        if (!TryGetCondominiumId(out var condominiumId)) return Unauthorized("User scope is invalid.");
        var (dto, error) = await _service.RejectCancellationAsync(id, request, condominiumId);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    private bool TryGetCondominiumId(out Guid condominiumId)
    {
        condominiumId = Guid.Empty;
        return Guid.TryParse(User.FindFirstValue("CondominiumId"), out condominiumId);
    }
}

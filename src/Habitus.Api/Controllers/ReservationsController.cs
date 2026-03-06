using Habitus.Application.DTOs.Reservations;
using Habitus.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/reservations")]
[Authorize]
public class ReservationsController : ControllerBase
{
    private readonly ReservationService _service;

    public ReservationsController(ReservationService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        return Ok(await _service.GetPagedAsync(page, pageSize, search));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReservationRequest request)
    {
        var (dto, error) = await _service.CreateAsync(request);
        if (error != null) return Conflict(error);
        return CreatedAtAction(nameof(GetById), new { id = dto!.Id }, dto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReservationRequest request)
    {
        var (dto, error) = await _service.UpdateAsync(id, request);
        if (error != null) return error.Contains("not found") ? NotFound(error) : Conflict(error);
        return Ok(dto);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var success = await _service.DeleteAsync(id);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        var (dto, error) = await _service.ApproveAsync(id, request);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        var (dto, error) = await _service.RejectAsync(id, request);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id}/request-cancellation")]
    public async Task<IActionResult> RequestCancellation(Guid id)
    {
        var (dto, error) = await _service.RequestCancellationAsync(id);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id}/approve-cancellation")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ApproveCancellation(Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        var (dto, error) = await _service.ApproveCancellationAsync(id, request);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }

    [HttpPost("{id}/reject-cancellation")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectCancellation(Guid id, [FromBody] ChangeReservationStatusRequest request)
    {
        var (dto, error) = await _service.RejectCancellationAsync(id, request);
        if (error != null) return error.Contains("not found") ? NotFound(error) : BadRequest(error);
        return Ok(dto);
    }
}

using Habitus.Api.Middleware;
using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Polls;
using Habitus.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/condominiums/{condominiumId:guid}/[controller]")]
[RequireFeature("polls")]
public class PollsController : ControllerBase
{
    private readonly IPollService _pollService;

    public PollsController(IPollService pollService)
    {
        _pollService = pollService;
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var userCondominiumClaim = User.FindFirstValue("CondominiumId");
        return Guid.TryParse(userCondominiumClaim, out var userCondominiumId) && userCondominiumId == condominiumId;
    }

    // POST: api/condominiums/{condominiumId:guid}/polls
    [HttpPost]
    public async Task<ActionResult<PollDto>> Create([FromRoute] Guid condominiumId, [FromBody] CreatePollRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();

        try
        {
            var dto = await _pollService.CreateAsync(condominiumId, userId, request);
            return CreatedAtAction(nameof(GetById), new { condominiumId, id = dto.Id }, dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // GET: api/condominiums/{condominiumId:guid}/polls/paged
    [HttpGet("paged")]
    public async Task<ActionResult<PaginatedResponse<PollDto>>> GetPaged(
        [FromRoute] Guid condominiumId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? status = null)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();

        var result = await _pollService.GetPagedAsync(condominiumId, userId, page, pageSize, status);
        return Ok(result);
    }

    // GET: api/condominiums/{condominiumId:guid}/polls/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<PollDto>> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();

        try
        {
            var dto = await _pollService.GetByIdAsync(condominiumId, id, userId);
            return Ok(dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    // POST: api/condominiums/{condominiumId:guid}/polls/{id}/votes
    [HttpPost("{id}/votes")]
    public async Task<ActionResult<PollDto>> CastVote([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] CastVoteRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();

        try
        {
            var dto = await _pollService.CastVoteAsync(condominiumId, id, userId, request);
            return Ok(dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex) when (IsConflict(ex.Message))
        {
            return Conflict(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // DELETE: api/condominiums/{condominiumId:guid}/polls/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Close([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();
        var userId = GetUserId();

        try
        {
            await _pollService.CloseAsync(condominiumId, id, userId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // Duplicate votes and voting on closed/expired polls are conflicting client states.
    private static bool IsConflict(string message) =>
        message.Contains("already voted", StringComparison.OrdinalIgnoreCase)
        || message.Contains("closed", StringComparison.OrdinalIgnoreCase)
        || message.Contains("expired", StringComparison.OrdinalIgnoreCase);
}

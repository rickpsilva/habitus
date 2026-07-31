using System.Security.Claims;
using Habitus.Application.DTOs.Memberships;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/platform/membership-association-requests")]
[Authorize]
public class MembershipAssociationRequestsController : ControllerBase
{
    private readonly AssociationRequestService _associationRequestService;

    public MembershipAssociationRequestsController(AssociationRequestService associationRequestService)
    {
        _associationRequestService = associationRequestService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAssociationRequestDto request)
    {
        if (!TryGetUserId(out var currentUserId))
        {
            return Unauthorized();
        }

        var currentRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

        try
        {
            var created = await _associationRequestService.CreateRequestAsync(
                currentUserId,
                currentRole,
                request.TargetCondominiumId,
                request.RequestedRole,
                request.Source,
                request.CorrelationId);

            return Ok(created);
        }
        catch (AssociationRequestConflictException ex)
        {
            return Conflict(new AssociationConflictErrorDto
            {
                Code = ex.Code,
                Message = ex.Message,
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMy([FromQuery] AssociationRequestStatus? status = null)
    {
        if (!TryGetUserId(out var currentUserId))
        {
            return Unauthorized();
        }

        var requests = await _associationRequestService.GetMyRequestsAsync(currentUserId, status);
        return Ok(requests);
    }

    [HttpGet("pending")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetPending()
    {
        if (!TryGetUserId(out var userId) || !TryGetCondominiumId(out var condominiumId))
        {
            return Unauthorized();
        }

        try
        {
            var pending = await _associationRequestService.GetPendingForCondominiumAsync(userId, condominiumId);
            return Ok(pending);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewAssociationRequestDto request)
    {
        if (!TryGetUserId(out var reviewerUserId) || !TryGetCondominiumId(out var reviewerCondominiumId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await _associationRequestService.ApproveAsync(
                id,
                reviewerUserId,
                reviewerCondominiumId,
                request.Reason);

            return Ok(result);
        }
        catch (AssociationRequestConflictException ex)
        {
            return Conflict(new AssociationConflictErrorDto { Code = ex.Code, Message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewAssociationRequestDto request)
    {
        if (!TryGetUserId(out var reviewerUserId) || !TryGetCondominiumId(out var reviewerCondominiumId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await _associationRequestService.RejectAsync(
                id,
                reviewerUserId,
                reviewerCondominiumId,
                request.Reason);

            return Ok(result);
        }
        catch (AssociationRequestConflictException ex)
        {
            return Conflict(new AssociationConflictErrorDto { Code = ex.Code, Message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    private bool TryGetUserId(out Guid userId)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdClaim, out userId);
    }

    private bool TryGetCondominiumId(out Guid condominiumId)
    {
        var claim = User.FindFirstValue("CondominiumId");
        return Guid.TryParse(claim, out condominiumId);
    }
}

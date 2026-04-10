using Habitus.Application.DTOs.Condominium;
using Habitus.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums")]
[Authorize]
public class CondominiumsController : ControllerBase
{
    private readonly CondominiumService _condominiumService;

    public CondominiumsController(CondominiumService condominiumService) 
        => _condominiumService = condominiumService;

    /// <summary>
    /// Get all condominiums (Manager only)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GetAllCondominiums()
    {
        var condominiums = await _condominiumService.GetAllCondominiumsAsync();
        return Ok(condominiums);
    }

    /// <summary>
    /// Public: minimal condominium list for the resident self-registration page. No authentication required.
    /// </summary>
    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicCondominiums()
    {
        var condominiums = await _condominiumService.GetPublicListAsync();
        return Ok(condominiums);
    }

    /// <summary>
    /// Public: units of a condominium for the resident self-registration page. No authentication required.
    /// </summary>
    [HttpGet("{condominiumId}/units/public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicUnits(Guid condominiumId)
    {
        var units = await _condominiumService.GetUnitsForRegistrationAsync(condominiumId);
        if (units == null) return NotFound();
        return Ok(units);
    }

    [HttpGet("paged")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GetPagedCondominiums([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        var condominiums = await _condominiumService.GetPagedCondominiumsAsync(page, pageSize, search);
        return Ok(condominiums);
    }

    /// <summary>
    /// Get condominium by ID (Manager can view any, Admin/Resident can view their own)
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetCondominiumById(Guid id)
    {
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;

        // If not Manager, verify user belongs to this condominium
        if (userRole != "Manager" && userCondominiumId != id.ToString())
        {
            return Forbid("You can only view your own condominium.");
        }

        var condominium = await _condominiumService.GetCondominiumByIdAsync(id);
        if (condominium == null) return NotFound();

        return Ok(condominium);
    }

    /// <summary>
    /// Create a new condominium (Manager only)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> CreateCondominium([FromBody] CreateCondominiumRequest request)
    {
        try
        {
            var condominium = await _condominiumService.CreateCondominiumAsync(request);
            return CreatedAtAction(nameof(GetCondominiumById), new { id = condominium.Id }, condominium);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Update condominium (Manager can update any, Admin can update their own)
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> UpdateCondominium(Guid id, [FromBody] UpdateCondominiumRequest request)
    {
        try
        {
            if (id != request.Id) return BadRequest("ID mismatch.");

            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            var userCondominiumId = User.FindFirst("CondominiumId")?.Value;

            // If Admin, they can only update their own condominium
            if (userRole == "Admin" && userCondominiumId != id.ToString())
            {
                return Forbid("Admins can only update their own condominium.");
            }

            if (userRole == "Manager" && request.Email != null)
            {
                return Forbid("Only admins can change condominium email.");
            }

            var condominium = await _condominiumService.UpdateCondominiumAsync(request);
            return Ok(condominium);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Update condominium contact email (Admin of the condominium only)
    /// </summary>
    [HttpPut("{id}/email")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateCondominiumEmail(Guid id, [FromBody] UpdateCondominiumEmailRequest request)
    {
        try
        {
            var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
            if (userCondominiumId != id.ToString())
            {
                return Forbid("Admins can only update the email of their own condominium.");
            }

            var condominium = await _condominiumService.UpdateCondominiumEmailAsync(id, request.Email);
            return Ok(condominium);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Delete condominium (Manager only)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> DeleteCondominium(Guid id)
    {
        try
        {
            var result = await _condominiumService.DeleteCondominiumAsync(id);
            if (!result) return NotFound();
            
            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

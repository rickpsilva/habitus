using System.Security.Claims;
using Habitus.Application.DTOs.Auth;
using Habitus.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/platform/[controller]")]
public class UserRegistrationController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly UserService _userService;

    public UserRegistrationController(AuthService authService, UserService userService)
    {
        _authService = authService;
        _userService = userService;
    }

    /// <summary>
    /// Public self-registration for residents of a specific condominium.
    /// The created user is inactive until approved by an Admin or an existing resident
    /// of the same unit.
    /// </summary>
    [HttpPost("register/{condominiumId}/resident")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterResident(
        Guid condominiumId,
        [FromBody] RegisterResidentRequest request)
    {
        var (response, error) = await _authService.RegisterResidentAsync(condominiumId, request);
        if (error != null) return BadRequest(new { message = error });
        return Ok(response);
    }

    /// <summary>
    /// Returns inactive residents pending approval for the JWT user's condominium.
    /// Accessible by Admin (all pending) and Resident (pending in their own unit).
    /// </summary>
    [HttpGet("pending")]
    [Authorize(Roles = "Admin,Resident")]
    public async Task<IActionResult> GetPendingUsers()
    {
        if (!TryGetScope(out var condominiumId, out _))
            return Unauthorized();

        var pending = await _userService.GetPendingUsersAsync(condominiumId);

        // Residents only see pending users for their own unit
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role == "Resident")
        {
            var unitIdStr = User.FindFirstValue("UnitId");
            if (Guid.TryParse(unitIdStr, out var unitId))
                pending = pending.Where(p => p.UnitId == unitId);
            else
                pending = Enumerable.Empty<Application.DTOs.Users.PendingUserDto>();
        }

        return Ok(pending);
    }

    /// <summary>
    /// Approves a pending resident. Sets IsActive = true.
    /// Requires Admin (same condominium) or Resident (same unit) role.
    /// </summary>
    [HttpPost("pending/{userId}/approve")]
    [Authorize(Roles = "Admin,Resident")]
    public async Task<IActionResult> ApprovePendingUser(Guid userId)
    {
        if (!TryGetScope(out _, out var approverInfo))
            return Unauthorized();

        var (approverId, approverRole, approverUnitId) = approverInfo;
        var (success, error) = await _userService.ApprovePendingUserAsync(
            userId, approverId, approverRole, approverUnitId);

        if (!success) return BadRequest(new { message = error });
        return Ok(new { message = "Utilizador aprovado com sucesso." });
    }

    /// <summary>
    /// Rejects (deletes) a pending resident.
    /// Requires Admin (same condominium) or Resident (same unit) role.
    /// </summary>
    [HttpDelete("pending/{userId}/reject")]
    [Authorize(Roles = "Admin,Resident")]
    public async Task<IActionResult> RejectPendingUser(Guid userId)
    {
        if (!TryGetScope(out _, out var approverInfo))
            return Unauthorized();

        var (approverId, approverRole, approverUnitId) = approverInfo;
        var (success, error) = await _userService.RejectPendingUserAsync(
            userId, approverId, approverRole, approverUnitId);

        if (!success) return BadRequest(new { message = error });
        return Ok(new { message = "Utilizador recusado e removido." });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private bool TryGetScope(
        out Guid condominiumId,
        out (Guid approverId, string approverRole, Guid? approverUnitId) approverInfo)
    {
        condominiumId = Guid.Empty;
        approverInfo = (Guid.Empty, string.Empty, null);

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var condominiumIdStr = User.FindFirstValue("CondominiumId");
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

        if (!Guid.TryParse(userIdStr, out var userId)) return false;
        if (!Guid.TryParse(condominiumIdStr, out condominiumId)) return false;

        Guid? unitId = null;
        if (Guid.TryParse(User.FindFirstValue("UnitId"), out var parsedUnitId))
            unitId = parsedUnitId;

        approverInfo = (userId, role, unitId);
        return true;
    }
}

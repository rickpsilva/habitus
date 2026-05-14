using Habitus.Application.DTOs.Users;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{


    /// <summary>
    /// Request GDPR erasure (any authenticated user)
    /// </summary>
    [HttpPost("me/gdpr-erasure")]
    public async Task<IActionResult> RequestGdprErasure()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId) || !Guid.TryParse(currentUserId, out var userId))
        {
            return Unauthorized("User ID not found in token");
        }

        try
        {
            await _userService.RequestGdprErasureAsync(userId, HttpContext.Connection.RemoteIpAddress?.ToString() ?? "");
            return Ok(new { message = "Pedido de eliminação dos dados enviado." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Approve GDPR erasure (Admin only)
    /// </summary>
    [HttpPost("{id}/gdpr-erasure/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ApproveGdprErasure(Guid id)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId) || !Guid.TryParse(currentUserId, out var adminId))
        {
            return Unauthorized("User ID not found in token");
        }

        try
        {
            await _userService.ApproveGdprErasureAsync(id, adminId);
            return Ok(new { message = "Eliminação/anomização dos dados concluída." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
    private readonly UserService _userService;

    public UsersController(UserService userService) => _userService = userService;

    /// <summary>
    /// Get all users (Manager only)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GetAllUsers()
    {
        var users = await _userService.GetAllUsersAsync();
        return Ok(users);
    }

    [HttpGet("paged")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GetPagedUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        var users = await _userService.GetPagedUsersAsync(page, pageSize, search);
        return Ok(users);
    }

    /// <summary>
    /// Get users by condominium (Admin only)
    /// </summary>
    [HttpGet("condominium/{condominiumId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetUsersByCondominium(Guid condominiumId)
    {
        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
        if (userCondominiumId != condominiumId.ToString())
        {
            return Forbid("You can only view users from your own condominium.");
        }

        var users = await _userService.GetUsersByCondominiumAsync(condominiumId);
        return Ok(users);
    }

    /// <summary>
    /// Get users by condominium with pagination (Admin only)
    /// </summary>
    [HttpGet("condominium/{condominiumId}/paged")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetUsersByCondominiumPaged(Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
        if (userCondominiumId != condominiumId.ToString())
        {
            return Forbid("You can only view users from your own condominium.");
        }

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var users = await _userService.GetUsersByCondominiumPagedAsync(condominiumId, page, pageSize, search);
        return Ok(users);
    }

    /// <summary>
    /// Get current authenticated user
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId) || !Guid.TryParse(currentUserId, out var userId))
        {
            return Unauthorized("User ID not found in token");
        }

        var user = await _userService.GetUserByIdAsync(userId);
        if (user == null) return NotFound("User not found");

        return Ok(user);
    }

    /// <summary>
    /// Get current GDPR consent status for authenticated user.
    /// </summary>
    [HttpGet("me/gdpr-consent/status")]
    public async Task<IActionResult> GetMyGdprConsentStatus()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId) || !Guid.TryParse(currentUserId, out var userId))
        {
            return Unauthorized("User ID not found in token");
        }

        var status = await _userService.GetGdprConsentStatusAsync(userId);
        return Ok(status);
    }

    /// <summary>
    /// Save GDPR consent for authenticated user.
    /// </summary>
    [HttpPost("me/gdpr-consent")]
    public async Task<IActionResult> SaveMyGdprConsent([FromBody] SaveGdprConsentRequest request)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId) || !Guid.TryParse(currentUserId, out var userId))
        {
            return Unauthorized("User ID not found in token");
        }

        try
        {
            var status = await _userService.SaveGdprConsentAsync(
                userId,
                HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
                request);
            return Ok(status);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Download authenticated user data export in JSON format.
    /// </summary>
    [HttpGet("me/data-export")]
    public async Task<IActionResult> DownloadMyDataExport()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId) || !Guid.TryParse(currentUserId, out var userId))
        {
            return Unauthorized("User ID not found in token");
        }

        try
        {
            var export = await _userService.GetMyDataExportAsync(userId);
            var json = JsonSerializer.Serialize(export, new JsonSerializerOptions { WriteIndented = true });
            var fileName = $"habitus-user-data-{userId}.json";
            return File(Encoding.UTF8.GetBytes(json), "application/json", fileName);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get user by ID (Manager, Admin for same condominium, or self)
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetUserById(Guid id)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;

        var user = await _userService.GetUserByIdAsync(id);
        if (user == null) return NotFound();

        // Authorization check
        if (userRole != "Manager")
        {
            // Admin can only see users from their condominium
            if (userRole == "Admin" && user.CondominiumId?.ToString() != userCondominiumId)
            {
                return Forbid("You can only view users from your own condominium.");
            }
            // Resident can only see themselves
            if (userRole == "Resident" && currentUserId != id.ToString())
            {
                return Forbid("You can only view your own profile.");
            }
        }

        return Ok(user);
    }

    /// <summary>
    /// Create a new user (Manager can create any, Admin can create for their condominium)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        try
        {
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            var userCondominiumId = User.FindFirst("CondominiumId")?.Value;

            // If Admin, they can only create users for their condominium
            if (userRole == "Admin")
            {
                if (!request.CondominiumId.HasValue || request.CondominiumId.ToString() != userCondominiumId)
                {
                    return Forbid("Admins can only create users for their own condominium.");
                }

                // Admins cannot create Managers
                if (request.Role.Equals("Manager", StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid("Admins cannot create Manager users.");
                }
            }

            var user = await _userService.CreateUserAsync(request);
            return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, user);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Update user (Manager can update any, Admin can update users in their condominium)
    /// </summary>
    /// <summary>
    /// Update own profile (any authenticated user)
    /// </summary>
    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateMyProfileRequest request)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId) || !Guid.TryParse(currentUserId, out var userId))
        {
            return Unauthorized("User ID not found in token");
        }

        try
        {
            var user = await _userService.UpdateMyProfileAsync(userId, request);
            return Ok(user);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        if (request.Id != id)
        {
            return BadRequest(new { error = "ID do utilizador inválido." });
        }

        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;

        if (userRole == "Admin")
        {
            if (!request.CondominiumId.HasValue || request.CondominiumId.ToString() != userCondominiumId)
            {
                return Forbid("Admins can only update users from their own condominium.");
            }

            if (request.Role.Equals("Manager", StringComparison.OrdinalIgnoreCase))
            {
                return Forbid("Admins cannot promote users to Manager.");
            }
        }

        try
        {
            var updated = await _userService.UpdateUserAsync(request);
            return Ok(updated);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id}/password")]
    public async Task<IActionResult> UpdateUserPassword(Guid id, [FromBody] UpdateUserPasswordRequest request)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId) || !Guid.TryParse(currentUserId, out var authenticatedUserId))
        {
            return Unauthorized("User ID not found in token");
        }

        if (authenticatedUserId != id)
        {
            return Forbid("You can only update your own password.");
        }

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { error = "Current password and new password are required." });
        }

        var updated = await _userService.UpdateUserPasswordAsync(id, request);
        if (!updated)
        {
            return BadRequest(new { error = "Senha atual inválida ou utilizador indisponível." });
        }

        return Ok(new { message = "Senha atualizada com sucesso." });
    }

    /// <summary>
    /// Delete user (Manager can delete any, Admin can delete from their condominium)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;

        var existingUser = await _userService.GetUserByIdAsync(id);
        if (existingUser == null) return NotFound();

        // If Admin, they can only delete users from their condominium
        if (userRole == "Admin")
        {
            if (existingUser.CondominiumId?.ToString() != userCondominiumId)
            {
                return Forbid("Admins can only delete users from their own condominium.");
            }

            // Admins cannot delete Managers or other Admins
            if (existingUser.Role == (int)UserRole.Manager || existingUser.Role == (int)UserRole.Admin)
            {
                return Forbid("Admins cannot delete Manager or Admin users.");
            }
        }

        var result = await _userService.DeleteUserAsync(id);
        if (!result) return NotFound();
        
        return NoContent();
    }

    /// <summary>
    /// Assign a user (Manager) to a condominium (Manager only)
    /// </summary>
    [HttpPost("assign-condominium")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> AssignUserToCondominium([FromBody] AssignUserToCondominiumRequest request)
    {
        try
        {
            await _userService.AssignUserToCondominiumAsync(request);
            return Ok(new { message = "Utilizador associado ao condomínio com sucesso." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get active users count grouped by condominium for the last month (Manager only)
    /// </summary>
    [HttpGet("active-last-month-by-condominium")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GetActiveLastMonthByCondominium()
    {
        var result = await _userService.GetActiveUsersByCondominiumLastMonthAsync();
        return Ok(result);
    }
}

using Habitus.Application.DTOs.Users;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
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
    /// Get users by condominium (Manager and Admin)
    /// </summary>
    [HttpGet("condominium/{condominiumId}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> GetUsersByCondominium(Guid condominiumId)
    {
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        
        // If Admin, verify they belong to this condominium
        if (userRole == "Admin")
        {
            var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
            if (userCondominiumId != condominiumId.ToString())
            {
                return Forbid("You can only view users from your own condominium.");
            }
        }

        var users = await _userService.GetUsersByCondominiumAsync(condominiumId);
        return Ok(users);
    }

    /// <summary>
    /// Get users by condominium with pagination (Manager and Admin)
    /// </summary>
    [HttpGet("condominium/{condominiumId}/paged")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> GetUsersByCondominiumPaged(Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        
        // If Admin, verify they belong to this condominium
        if (userRole == "Admin")
        {
            var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
            if (userCondominiumId != condominiumId.ToString())
            {
                return Forbid("You can only view users from your own condominium.");
            }
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
    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        try
        {
            if (id != request.Id) return BadRequest("ID mismatch.");

            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            var userCondominiumId = User.FindFirst("CondominiumId")?.Value;

            var existingUser = await _userService.GetUserByIdAsync(id);
            if (existingUser == null) return NotFound();

            // If Admin, they can only update users from their condominium
            if (userRole == "Admin")
            {
                if (existingUser.CondominiumId?.ToString() != userCondominiumId)
                {
                    return Forbid("Admins can only update users from their own condominium.");
                }

                // Admins cannot promote users to Manager
                if (request.Role.Equals("Manager", StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid("Admins cannot create or promote users to Manager role.");
                }
            }

            var user = await _userService.UpdateUserAsync(request);
            return Ok(user);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
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
            return Ok(new { message = "User assigned to condominium successfully." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

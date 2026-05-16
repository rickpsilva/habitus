using System.Security.Claims;
using Habitus.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/maintenance/rgpd-migration")]
[Authorize(Roles = "Manager")]
public class RgpdMigrationController : ControllerBase
{
    private readonly RgpdMigrationOperationsService _service;

    public RgpdMigrationController(RgpdMigrationOperationsService service)
    {
        _service = service;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken cancellationToken)
    {
        var status = await _service.GetStatusAsync(cancellationToken);
        return Ok(status);
    }

    [HttpPost("run")]
    public async Task<IActionResult> RunMigration(CancellationToken cancellationToken)
    {
        var userId = TryGetUserId();

        try
        {
            var run = await _service.RunBackfillAsync(userId, cancellationToken);
            return Ok(run);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("audit")]
    public async Task<IActionResult> RunAudit(CancellationToken cancellationToken)
    {
        var userId = TryGetUserId();

        try
        {
            var run = await _service.RunAuditAsync(userId, cancellationToken);
            return Ok(run);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    private Guid? TryGetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}

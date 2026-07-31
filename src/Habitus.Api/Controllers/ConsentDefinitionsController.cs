using System.Security.Claims;
using Habitus.Application.DTOs.Consents;
using Habitus.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

/// <summary>
/// Manager-only authoring of consent documents (REQ-SEC-008). Managers can list all consent
/// definitions with their bodies, correct an existing definition in place (same Key/Version, no
/// re-consent), and publish a new version of a Key (which forces re-consent via the existing
/// latest-active-version-per-key semantics). Any non-Manager authenticated caller gets 403.
/// </summary>
[ApiController]
[Route("api/platform/consents")]
[Authorize]
public class ConsentDefinitionsController : ControllerBase
{
    private readonly IConsentService _consentService;

    public ConsentDefinitionsController(IConsentService consentService)
    {
        _consentService = consentService;
    }

    /// <summary>Lists every consent definition (all versions, with bodies and audit fields).</summary>
    [HttpGet]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> List()
    {
        var definitions = await _consentService.ListDefinitionsAsync();
        return Ok(definitions);
    }

    /// <summary>
    /// Corrects a definition in place (Title/Url/Body only). Keeps Key/Version so users already
    /// compliant are not re-prompted. Returns 404 <c>not_found</c> for an unknown id.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> UpdateInPlace(Guid id, [FromBody] UpdateConsentDefinitionRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await _consentService.UpdateDefinitionInPlaceAsync(id, request, userId);
            return Ok(result);
        }
        catch (ConsentAuthoringException ex) when (ex.Code == "not_found")
        {
            return NotFound(new { code = ex.Code, message = ex.Message });
        }
    }

    /// <summary>
    /// Publishes a new active version of a Key (forces re-consent). Returns 409
    /// <c>duplicate_version</c> when the {Key, Version} already exists.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Publish([FromBody] PublishConsentVersionRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await _consentService.PublishNewVersionAsync(request, userId);
            return CreatedAtAction(nameof(List), new { }, result);
        }
        catch (ConsentAuthoringException ex) when (ex.Code == "duplicate_version")
        {
            return Conflict(new { code = ex.Code, message = ex.Message });
        }
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdClaim, out userId);
    }
}

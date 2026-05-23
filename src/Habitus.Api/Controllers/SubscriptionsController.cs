using System.Security.Claims;
using Habitus.Application.DTOs.Subscriptions;
using Habitus.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/platform/[controller]")]
[Authorize]
public class SubscriptionsController : ControllerBase
{
    private readonly SubscriptionService _service;

    public SubscriptionsController(SubscriptionService service) => _service = service;

    // GET api/subscriptions/plans — available to all authenticated users
    [HttpGet("plans")]
    public async Task<IActionResult> GetPlans()
    {
        var plans = await _service.GetAllPlansAsync();
        return Ok(plans);
    }

    // GET api/subscriptions/plans/{id}
    [HttpGet("plans/{id:guid}")]
    public async Task<IActionResult> GetPlan(Guid id)
    {
        var plan = await _service.GetPlanByIdAsync(id);
        return plan is null ? NotFound() : Ok(plan);
    }

    // GET api/subscriptions/features/catalog
    [HttpGet("features/catalog")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GetFeatureCatalog()
    {
        var features = await _service.GetFeatureCatalogAsync();
        return Ok(features);
    }

    // POST api/subscriptions/plans - create plan (Manager only)
    [HttpPost("plans")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> CreatePlan([FromBody] CreateSubscriptionPlanRequest request)
    {
        try
        {
            var plan = await _service.CreatePlanAsync(request);
            return CreatedAtAction(nameof(GetPlan), new { id = plan.Id }, plan);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PUT api/subscriptions/plans/{id} - update plan (Manager only)
    [HttpPut("plans/{id:guid}")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> UpdatePlan(Guid id, [FromBody] UpdateSubscriptionPlanRequest request)
    {
        try
        {
            var plan = await _service.UpdatePlanAsync(id, request);
            return Ok(plan);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST api/subscriptions/plans/reset-defaults - restore canonical Free/Silver/Gold plans
    [HttpPost("plans/reset-defaults")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> ResetDefaultPlans()
    {
        var plans = await _service.ResetDefaultPlansAsync();
        return Ok(plans);
    }

    // GET api/subscriptions — all active subscriptions (Manager only)
    [HttpGet]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GetAllSubscriptions()
    {
        var subs = await _service.GetAllSubscriptionsAsync();
        return Ok(subs);
    }

    // GET api/subscriptions/stats — platform billing stats (Manager only)
    [HttpGet("stats")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _service.GetStatsAsync();
        return Ok(stats);
    }

    // GET api/subscriptions/my — subscription for the caller's condominium
    [HttpGet("my")]
    public async Task<IActionResult> GetMySubscription()
    {
        var condominiumClaim = User.FindFirstValue("CondominiumId");
        if (!Guid.TryParse(condominiumClaim, out var condominiumId))
            return NotFound();

        var sub = await _service.GetCondominiumSubscriptionAsync(condominiumId);
        return sub is null ? NotFound() : Ok(sub);
    }

    // POST api/subscriptions — assign a plan to a condominium (Manager only)
    [HttpPost]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> AssignSubscription([FromBody] AssignSubscriptionRequest request)
    {
        try
        {
            var sub = await _service.AssignSubscriptionAsync(request);
            return Ok(sub);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // DELETE api/subscriptions/{id} — cancel a subscription (Manager only)
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> CancelSubscription(Guid id)
    {
        try
        {
            await _service.CancelSubscriptionAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}

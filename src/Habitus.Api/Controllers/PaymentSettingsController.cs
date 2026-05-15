using Habitus.Application.DTOs.Payments;
using Habitus.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId}/payment-settings")]
[Authorize(Roles = "Admin,Manager")]
public class PaymentSettingsController : ControllerBase
{
    private readonly PaymentSettingsService _paymentSettingsService;

    public PaymentSettingsController(PaymentSettingsService paymentSettingsService)
    {
        _paymentSettingsService = paymentSettingsService;
    }

    /// <summary>
    /// Get payment settings for a condominium
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(Guid condominiumId)
    {
        try
        {
            return Ok(await _paymentSettingsService.GetAsync(condominiumId));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update payment settings for a condominium
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> Update(Guid condominiumId, [FromBody] UpdatePaymentSettingsRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);
            return Ok(await _paymentSettingsService.UpdateAsync(condominiumId, request));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

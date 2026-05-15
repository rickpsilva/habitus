using Habitus.Application.Services;
using Habitus.Application.DTOs.Receipts;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId}/receipt-template-settings")]
[Authorize(Roles = "Admin,Manager")]
public class ReceiptTemplateSettingsController : ControllerBase
{
    private readonly ReceiptTemplateSettingsService _service;

    public ReceiptTemplateSettingsController(ReceiptTemplateSettingsService service)
    {
        _service = service;
    }

    /// <summary>
    /// Get receipt template settings for a condominium
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(Guid condominiumId)
    {
        try
        {
            var dto = await _service.GetByCondominiumIdAsync(condominiumId);
            if (dto == null)
            {
                // Return default settings if none exist
                return Ok(new ReceiptTemplateSettingsDto
                {
                    Id = Guid.Empty,
                    CondominiumId = condominiumId,
                    CompanyName = null,
                    Address = null,
                    PostalCode = null,
                    Locality = null,
                    TaxId = null,
                    Email = null,
                    Phone = null,
                    Template = null,
                    TemplateMonthlyFee = null,
                    TemplateMonthlyFeeQuarterly = null,
                    TemplateMonthlyFeeAnnual = null,
                    TemplateExtraordinaryFee = null,
                    TemplateReservation = null,
                    TemplateOther = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            return Ok(dto);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update receipt template settings for a condominium
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> Update(Guid condominiumId, [FromBody] UpdateReceiptTemplateSettingsRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var dto = await _service.UpsertAsync(condominiumId, request);
            return Ok(dto);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

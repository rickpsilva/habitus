using Habitus.Application.DTOs.Receipts;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/receipt-template-settings")]
[Authorize(Roles = "Admin,Manager")]
public class ReceiptTemplateSettingsController : ControllerBase
{
    private readonly IRepository<ReceiptTemplateSettings> _repository;

    public ReceiptTemplateSettingsController(IRepository<ReceiptTemplateSettings> repository)
    {
        _repository = repository;
    }

    /// <summary>
    /// Get receipt template settings for a condominium
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromRoute] Guid condominiumId)
    {
        try
        {
            var settings = await _repository.FindAsync(rts => rts.CondominiumId == condominiumId);
            var receiptTemplateSettings = settings.FirstOrDefault();

            if (receiptTemplateSettings == null)
            {
                // Return default settings if none exist
                return Ok(new ReceiptTemplateSettingsDto
                {
                    Id = Guid.Empty,
                    CondominiumId = condominiumId,
                    Template = null,
                    TemplateMonthlyFee = null,
                    TemplateMonthlyFeeQuarterly = null,
                    TemplateMonthlyFeeAnnual = null,
                    TemplateExtraordinaryFee = null,
                    TemplateReservation = null,
                    TemplateOther = null,
                    IncludeCondominiumName = true,
                    IncludeTaxId = true,
                    IncludeAddress = true,
                    IncludePostalCode = true,
                    IncludeLocality = true,
                    IncludeEmail = true,
                    IncludeContactPhone = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            var dto = new ReceiptTemplateSettingsDto
            {
                Id = receiptTemplateSettings.Id,
                CondominiumId = receiptTemplateSettings.CondominiumId,
                Template = receiptTemplateSettings.Template,
                TemplateMonthlyFee = receiptTemplateSettings.TemplateMonthlyFee,
                TemplateMonthlyFeeQuarterly = receiptTemplateSettings.TemplateMonthlyFeeQuarterly,
                TemplateMonthlyFeeAnnual = receiptTemplateSettings.TemplateMonthlyFeeAnnual,
                TemplateExtraordinaryFee = receiptTemplateSettings.TemplateExtraordinaryFee,
                TemplateReservation = receiptTemplateSettings.TemplateReservation,
                TemplateOther = receiptTemplateSettings.TemplateOther,
                IncludeCondominiumName = receiptTemplateSettings.IncludeCondominiumName,
                IncludeTaxId = receiptTemplateSettings.IncludeTaxId,
                IncludeAddress = receiptTemplateSettings.IncludeAddress,
                IncludePostalCode = receiptTemplateSettings.IncludePostalCode,
                IncludeLocality = receiptTemplateSettings.IncludeLocality,
                IncludeEmail = receiptTemplateSettings.IncludeEmail,
                IncludeContactPhone = receiptTemplateSettings.IncludeContactPhone,
                CreatedAt = receiptTemplateSettings.CreatedAt,
                UpdatedAt = receiptTemplateSettings.UpdatedAt
            };

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
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromBody] UpdateReceiptTemplateSettingsRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var settings = await _repository.FindAsync(rts => rts.CondominiumId == condominiumId);
            var receiptTemplateSettings = settings.FirstOrDefault();

            bool isNew = false;
            if (receiptTemplateSettings == null)
            {
                // Create new settings
                isNew = true;
                receiptTemplateSettings = new ReceiptTemplateSettings
                {
                    Id = Guid.NewGuid(),
                    CondominiumId = condominiumId,
                    CreatedAt = DateTime.UtcNow
                };
            }

            // Update fields
            receiptTemplateSettings.Template = request.Template;
            receiptTemplateSettings.TemplateMonthlyFee = request.TemplateMonthlyFee;
            receiptTemplateSettings.TemplateMonthlyFeeQuarterly = request.TemplateMonthlyFeeQuarterly;
            receiptTemplateSettings.TemplateMonthlyFeeAnnual = request.TemplateMonthlyFeeAnnual;
            receiptTemplateSettings.TemplateExtraordinaryFee = request.TemplateExtraordinaryFee;
            receiptTemplateSettings.TemplateReservation = request.TemplateReservation;
            receiptTemplateSettings.TemplateOther = request.TemplateOther;
            receiptTemplateSettings.IncludeCondominiumName = request.IncludeCondominiumName;
            receiptTemplateSettings.IncludeTaxId = request.IncludeTaxId;
            receiptTemplateSettings.IncludeAddress = request.IncludeAddress;
            receiptTemplateSettings.IncludePostalCode = request.IncludePostalCode;
            receiptTemplateSettings.IncludeLocality = request.IncludeLocality;
            receiptTemplateSettings.IncludeEmail = request.IncludeEmail;
            receiptTemplateSettings.IncludeContactPhone = request.IncludeContactPhone;
            receiptTemplateSettings.UpdatedAt = DateTime.UtcNow;

            if (isNew)
            {
                await _repository.AddAsync(receiptTemplateSettings);
            }
            else
            {
                _repository.Update(receiptTemplateSettings);
            }

            await _repository.SaveChangesAsync();

            var dto = new ReceiptTemplateSettingsDto
            {
                Id = receiptTemplateSettings.Id,
                CondominiumId = receiptTemplateSettings.CondominiumId,
                Template = receiptTemplateSettings.Template,
                TemplateMonthlyFee = receiptTemplateSettings.TemplateMonthlyFee,
                TemplateMonthlyFeeQuarterly = receiptTemplateSettings.TemplateMonthlyFeeQuarterly,
                TemplateMonthlyFeeAnnual = receiptTemplateSettings.TemplateMonthlyFeeAnnual,
                TemplateExtraordinaryFee = receiptTemplateSettings.TemplateExtraordinaryFee,
                TemplateReservation = receiptTemplateSettings.TemplateReservation,
                TemplateOther = receiptTemplateSettings.TemplateOther,
                IncludeCondominiumName = receiptTemplateSettings.IncludeCondominiumName,
                IncludeTaxId = receiptTemplateSettings.IncludeTaxId,
                IncludeAddress = receiptTemplateSettings.IncludeAddress,
                IncludePostalCode = receiptTemplateSettings.IncludePostalCode,
                IncludeLocality = receiptTemplateSettings.IncludeLocality,
                IncludeEmail = receiptTemplateSettings.IncludeEmail,
                IncludeContactPhone = receiptTemplateSettings.IncludeContactPhone,
                CreatedAt = receiptTemplateSettings.CreatedAt,
                UpdatedAt = receiptTemplateSettings.UpdatedAt
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

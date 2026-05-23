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

            var dto = new ReceiptTemplateSettingsDto
            {
                Id = receiptTemplateSettings.Id,
                CondominiumId = receiptTemplateSettings.CondominiumId,
                CompanyName = receiptTemplateSettings.CompanyName,
                Address = receiptTemplateSettings.Address,
                PostalCode = receiptTemplateSettings.PostalCode,
                Locality = receiptTemplateSettings.Locality,
                TaxId = receiptTemplateSettings.TaxId,
                Email = receiptTemplateSettings.Email,
                Phone = receiptTemplateSettings.Phone,
                Template = receiptTemplateSettings.Template,
                TemplateMonthlyFee = receiptTemplateSettings.TemplateMonthlyFee,
                TemplateMonthlyFeeQuarterly = receiptTemplateSettings.TemplateMonthlyFeeQuarterly,
                TemplateMonthlyFeeAnnual = receiptTemplateSettings.TemplateMonthlyFeeAnnual,
                TemplateExtraordinaryFee = receiptTemplateSettings.TemplateExtraordinaryFee,
                TemplateReservation = receiptTemplateSettings.TemplateReservation,
                TemplateOther = receiptTemplateSettings.TemplateOther,
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
            receiptTemplateSettings.CompanyName = request.CompanyName;
            receiptTemplateSettings.Address = request.Address;
            receiptTemplateSettings.PostalCode = request.PostalCode;
            receiptTemplateSettings.Locality = request.Locality;
            receiptTemplateSettings.TaxId = request.TaxId;
            receiptTemplateSettings.Email = request.Email;
            receiptTemplateSettings.Phone = request.Phone;
            receiptTemplateSettings.Template = request.Template;
            receiptTemplateSettings.TemplateMonthlyFee = request.TemplateMonthlyFee;
            receiptTemplateSettings.TemplateMonthlyFeeQuarterly = request.TemplateMonthlyFeeQuarterly;
            receiptTemplateSettings.TemplateMonthlyFeeAnnual = request.TemplateMonthlyFeeAnnual;
            receiptTemplateSettings.TemplateExtraordinaryFee = request.TemplateExtraordinaryFee;
            receiptTemplateSettings.TemplateReservation = request.TemplateReservation;
            receiptTemplateSettings.TemplateOther = request.TemplateOther;
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
                CompanyName = receiptTemplateSettings.CompanyName,
                Address = receiptTemplateSettings.Address,
                PostalCode = receiptTemplateSettings.PostalCode,
                Locality = receiptTemplateSettings.Locality,
                TaxId = receiptTemplateSettings.TaxId,
                Email = receiptTemplateSettings.Email,
                Phone = receiptTemplateSettings.Phone,
                Template = receiptTemplateSettings.Template,
                TemplateMonthlyFee = receiptTemplateSettings.TemplateMonthlyFee,
                TemplateMonthlyFeeQuarterly = receiptTemplateSettings.TemplateMonthlyFeeQuarterly,
                TemplateMonthlyFeeAnnual = receiptTemplateSettings.TemplateMonthlyFeeAnnual,
                TemplateExtraordinaryFee = receiptTemplateSettings.TemplateExtraordinaryFee,
                TemplateReservation = receiptTemplateSettings.TemplateReservation,
                TemplateOther = receiptTemplateSettings.TemplateOther,
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

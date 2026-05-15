using Habitus.Application.DTOs.Payments;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId}/payment-settings")]
[Authorize(Roles = "Admin,Manager")]
public class PaymentSettingsController : ControllerBase
{
    private readonly IRepository<PaymentSettings> _repository;
    private readonly IEncryptionService _encryptionService;

    public PaymentSettingsController(IRepository<PaymentSettings> repository, IEncryptionService encryptionService)
    {
        _repository = repository;
        _encryptionService = encryptionService;
    }

    /// <summary>
    /// Get payment settings for a condominium
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(Guid condominiumId)
    {
        try
        {
            var settings = await _repository.FindAsync(ps => ps.CondominiumId == condominiumId);
            var paymentSettings = settings.FirstOrDefault();

            if (paymentSettings == null)
            {
                // Return default settings if none exist
                return Ok(new PaymentSettingsDto
                {
                    Id = Guid.Empty,
                    CondominiumId = condominiumId,
                    BankTransferEnabled = true,
                    BankTransferIban = null,
                    BankTransferAccountHolder = null,
                    MBReferenceEnabled = false,
                    MBReferenceEntity = null,
                    MBReferenceReference = null,
                    MBWayEnabled = false,
                    MBWayPhoneNumber = null,
                    MBWayMerchantId = null,
                    CardEnabled = false,
                    CardProvider = null,
                    CardPublicKey = null,
                    CardMerchantId = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            var dto = new PaymentSettingsDto
            {
                Id = paymentSettings.Id,
                CondominiumId = paymentSettings.CondominiumId,
                BankTransferEnabled = paymentSettings.BankTransferEnabled,
                BankTransferIban = !string.IsNullOrEmpty(paymentSettings.BankTransferIbanEncrypted)
                    ? _encryptionService.Decrypt(paymentSettings.BankTransferIbanEncrypted)
                    : paymentSettings.BankTransferIban,
                BankTransferAccountHolder = paymentSettings.BankTransferAccountHolder,
                MBReferenceEnabled = paymentSettings.MBReferenceEnabled,
                MBReferenceEntity = paymentSettings.MBReferenceEntity,
                MBReferenceReference = paymentSettings.MBReferenceReference,
                MBWayEnabled = paymentSettings.MBWayEnabled,
                MBWayPhoneNumber = paymentSettings.MBWayPhoneNumber,
                MBWayMerchantId = paymentSettings.MBWayMerchantId,
                CardEnabled = paymentSettings.CardEnabled,
                CardProvider = paymentSettings.CardProvider,
                CardPublicKey = paymentSettings.CardPublicKey,
                CardMerchantId = paymentSettings.CardMerchantId,
                CreatedAt = paymentSettings.CreatedAt,
                UpdatedAt = paymentSettings.UpdatedAt
            };

            return Ok(dto);
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

            var settings = await _repository.FindAsync(ps => ps.CondominiumId == condominiumId);
            var paymentSettings = settings.FirstOrDefault();

            bool isNew = false;
            if (paymentSettings == null)
            {
                // Create new settings
                isNew = true;
                paymentSettings = new PaymentSettings
                {
                    Id = Guid.NewGuid(),
                    CondominiumId = condominiumId,
                    CreatedAt = DateTime.UtcNow
                };
            }

            // Update fields
            paymentSettings.BankTransferEnabled = request.BankTransferEnabled;
            paymentSettings.BankTransferIban = request.BankTransferIban;
            paymentSettings.BankTransferIbanEncrypted = string.IsNullOrWhiteSpace(request.BankTransferIban)
                ? null
                : _encryptionService.Encrypt(request.BankTransferIban);
            paymentSettings.BankTransferAccountHolder = request.BankTransferAccountHolder;
            
            paymentSettings.MBReferenceEnabled = request.MBReferenceEnabled;
            paymentSettings.MBReferenceEntity = request.MBReferenceEntity;
            paymentSettings.MBReferenceReference = request.MBReferenceReference;
            
            paymentSettings.MBWayEnabled = request.MBWayEnabled;
            paymentSettings.MBWayPhoneNumber = request.MBWayPhoneNumber;
            paymentSettings.MBWayMerchantId = request.MBWayMerchantId;
            
            paymentSettings.CardEnabled = request.CardEnabled;
            paymentSettings.CardProvider = request.CardProvider;
            paymentSettings.CardPublicKey = request.CardPublicKey;
            
            // Only update secret key if provided
            if (!string.IsNullOrWhiteSpace(request.CardSecretKey))
            {
                paymentSettings.CardSecretKeyEncrypted = _encryptionService.Encrypt(request.CardSecretKey);
                paymentSettings.CardSecretKey = null;
            }
            
            paymentSettings.CardMerchantId = request.CardMerchantId;
            paymentSettings.UpdatedAt = DateTime.UtcNow;

            if (isNew)
            {
                await _repository.AddAsync(paymentSettings);
            }
            else
            {
                _repository.Update(paymentSettings);
            }
            
            await _repository.SaveChangesAsync();

            var dto = new PaymentSettingsDto
            {
                Id = paymentSettings.Id,
                CondominiumId = paymentSettings.CondominiumId,
                BankTransferEnabled = paymentSettings.BankTransferEnabled,
                BankTransferIban = paymentSettings.BankTransferIban,
                BankTransferAccountHolder = paymentSettings.BankTransferAccountHolder,
                MBReferenceEnabled = paymentSettings.MBReferenceEnabled,
                MBReferenceEntity = paymentSettings.MBReferenceEntity,
                MBReferenceReference = paymentSettings.MBReferenceReference,
                MBWayEnabled = paymentSettings.MBWayEnabled,
                MBWayPhoneNumber = paymentSettings.MBWayPhoneNumber,
                MBWayMerchantId = paymentSettings.MBWayMerchantId,
                CardEnabled = paymentSettings.CardEnabled,
                CardProvider = paymentSettings.CardProvider,
                CardPublicKey = paymentSettings.CardPublicKey,
                CardMerchantId = paymentSettings.CardMerchantId,
                CreatedAt = paymentSettings.CreatedAt,
                UpdatedAt = paymentSettings.UpdatedAt
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

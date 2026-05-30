using Habitus.Application.DTOs.Payments;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/payment-settings")]
[Authorize(Roles = "Admin,Manager")]
public class PaymentSettingsController : ControllerBase
{
    private readonly IRepository<PaymentSettings> _repository;
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<PaymentSettingsController> _logger;

    public PaymentSettingsController(
        IRepository<PaymentSettings> repository,
        IEncryptionService encryptionService,
        ILogger<PaymentSettingsController> logger)
    {
        _repository = repository;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    /// <summary>
    /// Get payment settings for a condominium
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromRoute] Guid condominiumId)
    {
        try
        {
            var paymentSettings = await _repository.FirstOrDefaultNoTrackingAsync(ps => ps.CondominiumId == condominiumId);

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
                BankTransferIban = DecryptIfPresent(paymentSettings.BankTransferIbanEncrypted),
                BankTransferAccountHolder = DecryptIfPresent(paymentSettings.BankTransferAccountHolderEncrypted),
                MBReferenceEnabled = paymentSettings.MBReferenceEnabled,
                MBReferenceEntity = DecryptIfPresent(paymentSettings.MBReferenceEntityEncrypted),
                MBReferenceReference = DecryptIfPresent(paymentSettings.MBReferenceReferenceEncrypted),
                MBWayEnabled = paymentSettings.MBWayEnabled,
                MBWayPhoneNumber = DecryptIfPresent(paymentSettings.MBWayPhoneNumberEncrypted),
                MBWayMerchantId = DecryptIfPresent(paymentSettings.MBWayMerchantIdEncrypted),
                CardEnabled = paymentSettings.CardEnabled,
                CardProvider = paymentSettings.CardProvider,
                CardPublicKey = paymentSettings.CardPublicKey,
                CardMerchantId = DecryptIfPresent(paymentSettings.CardMerchantIdEncrypted),
                CreatedAt = paymentSettings.CreatedAt,
                UpdatedAt = paymentSettings.UpdatedAt
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get payment settings for condominium {CondominiumId}", condominiumId);
            return StatusCode(500, new { message = "Unable to fetch payment settings." });
        }
    }

    /// <summary>
    /// Update payment settings for a condominium
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromBody] UpdatePaymentSettingsRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var paymentSettings = await _repository.FirstOrDefaultAsync(ps => ps.CondominiumId == condominiumId);

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
            paymentSettings.BankTransferIbanEncrypted = EncryptIfPresent(request.BankTransferIban);
            paymentSettings.BankTransferAccountHolderEncrypted = EncryptIfPresent(request.BankTransferAccountHolder);
            
            paymentSettings.MBReferenceEnabled = request.MBReferenceEnabled;
            paymentSettings.MBReferenceEntityEncrypted = EncryptIfPresent(request.MBReferenceEntity);
            paymentSettings.MBReferenceReferenceEncrypted = EncryptIfPresent(request.MBReferenceReference);
            
            paymentSettings.MBWayEnabled = request.MBWayEnabled;
            paymentSettings.MBWayPhoneNumberEncrypted = EncryptIfPresent(request.MBWayPhoneNumber);
            paymentSettings.MBWayMerchantIdEncrypted = EncryptIfPresent(request.MBWayMerchantId);
            
            paymentSettings.CardEnabled = request.CardEnabled;
            paymentSettings.CardProvider = request.CardProvider;
            paymentSettings.CardPublicKey = request.CardPublicKey;
            
            // Only update secret key if provided
            if (!string.IsNullOrWhiteSpace(request.CardSecretKey))
            {
                paymentSettings.CardSecretKeyEncrypted = EncryptIfPresent(request.CardSecretKey);
            }
            
            paymentSettings.CardMerchantIdEncrypted = EncryptIfPresent(request.CardMerchantId);
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
                BankTransferIban = DecryptIfPresent(paymentSettings.BankTransferIbanEncrypted),
                BankTransferAccountHolder = DecryptIfPresent(paymentSettings.BankTransferAccountHolderEncrypted),
                MBReferenceEnabled = paymentSettings.MBReferenceEnabled,
                MBReferenceEntity = DecryptIfPresent(paymentSettings.MBReferenceEntityEncrypted),
                MBReferenceReference = DecryptIfPresent(paymentSettings.MBReferenceReferenceEncrypted),
                MBWayEnabled = paymentSettings.MBWayEnabled,
                MBWayPhoneNumber = DecryptIfPresent(paymentSettings.MBWayPhoneNumberEncrypted),
                MBWayMerchantId = DecryptIfPresent(paymentSettings.MBWayMerchantIdEncrypted),
                CardEnabled = paymentSettings.CardEnabled,
                CardProvider = paymentSettings.CardProvider,
                CardPublicKey = paymentSettings.CardPublicKey,
                CardMerchantId = DecryptIfPresent(paymentSettings.CardMerchantIdEncrypted),
                CreatedAt = paymentSettings.CreatedAt,
                UpdatedAt = paymentSettings.UpdatedAt
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update payment settings for condominium {CondominiumId}", condominiumId);
            return StatusCode(500, new { message = "Unable to update payment settings." });
        }
    }

    private string? EncryptIfPresent(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return _encryptionService.Encrypt(value.Trim());
    }

    private string? DecryptIfPresent(string? encryptedValue)
    {
        if (string.IsNullOrWhiteSpace(encryptedValue))
        {
            return null;
        }

        try
        {
            return _encryptionService.Decrypt(encryptedValue);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Unable to decrypt payment settings field for condominium {CondominiumId}. Returning null for this field.",
                RouteData.Values["condominiumId"]);
            return null;
        }
    }
}

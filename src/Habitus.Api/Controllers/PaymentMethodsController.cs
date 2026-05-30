using Habitus.Application.DTOs.Payments;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/payment-methods")]
[Authorize] // Accessible to all authenticated users (including residents)
public class PaymentMethodsController : ControllerBase
{
    private readonly IRepository<PaymentSettings> _repository;
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<PaymentMethodsController> _logger;

    public PaymentMethodsController(
        IRepository<PaymentSettings> repository,
        IEncryptionService encryptionService,
        ILogger<PaymentMethodsController> logger)
    {
        _repository = repository;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    /// <summary>
    /// Get public payment methods information for residents to make payments
    /// This endpoint returns only non-sensitive payment information
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPublicPaymentMethods([FromRoute] Guid condominiumId)
    {
        try
        {
            _logger.LogInformation("Getting payment methods for condominium {CondominiumId}", condominiumId);

            var paymentSettings = await _repository.FirstOrDefaultNoTrackingAsync(ps => ps.CondominiumId == condominiumId);

            if (paymentSettings == null)
            {
                _logger.LogInformation("No payment settings found for condominium {CondominiumId}, returning defaults", condominiumId);
                // Return default settings if none exist
                return Ok(new PaymentMethodsPublicDto
                {
                    BankTransferEnabled = true,
                    BankTransferIban = null,
                    BankTransferAccountHolder = null,
                    MBReferenceEnabled = false,
                    MBReferenceEntity = null,
                    MBReferenceReference = null,
                    MBWayEnabled = false,
                    MBWayPhoneNumber = null,
                    CardEnabled = false,
                    CardProvider = null,
                    CardPublicKey = null
                });
            }

            _logger.LogInformation("Payment settings found for condominium {CondominiumId}", condominiumId);

            var decryptedIban = DecryptIfPresent(paymentSettings.BankTransferIbanEncrypted);
            var decryptedAccountHolder = DecryptIfPresent(paymentSettings.BankTransferAccountHolderEncrypted);
            var decryptedReferenceEntity = DecryptIfPresent(paymentSettings.MBReferenceEntityEncrypted);
            var decryptedReference = DecryptIfPresent(paymentSettings.MBReferenceReferenceEncrypted);
            var decryptedMbWayPhone = DecryptIfPresent(paymentSettings.MBWayPhoneNumberEncrypted);

            var dto = new PaymentMethodsPublicDto
            {
                BankTransferEnabled = paymentSettings.BankTransferEnabled,
                BankTransferIban = decryptedIban,
                BankTransferAccountHolder = decryptedAccountHolder,
                MBReferenceEnabled = paymentSettings.MBReferenceEnabled,
                MBReferenceEntity = decryptedReferenceEntity,
                MBReferenceReference = decryptedReference,
                MBWayEnabled = paymentSettings.MBWayEnabled,
                MBWayPhoneNumber = decryptedMbWayPhone,
                CardEnabled = paymentSettings.CardEnabled,
                CardProvider = paymentSettings.CardProvider,
                CardPublicKey = paymentSettings.CardPublicKey
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting payment methods for condominium {CondominiumId}", condominiumId);
            return StatusCode(500, new { message = "Unable to fetch payment methods." });
        }
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
            _logger.LogWarning(ex, "Unable to decrypt payment method field for condominium {CondominiumId}. Returning null for this field.",
                RouteData.Values["condominiumId"]);
            return null;
        }
    }
}

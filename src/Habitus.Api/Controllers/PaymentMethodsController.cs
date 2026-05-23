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
    private readonly ILogger<PaymentMethodsController> _logger;

    public PaymentMethodsController(
        IRepository<PaymentSettings> repository,
        ILogger<PaymentMethodsController> logger)
    {
        _repository = repository;
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
            
            // Get all settings first
            var allSettings = await _repository.GetAllAsync();
            _logger.LogInformation("Total payment settings in DB: {Count}", allSettings.Count());
            
            // Filter by condominium
            var paymentSettings = allSettings.FirstOrDefault(ps => ps.CondominiumId == condominiumId);

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

            var dto = new PaymentMethodsPublicDto
            {
                BankTransferEnabled = paymentSettings.BankTransferEnabled,
                BankTransferIban = paymentSettings.BankTransferIban,
                BankTransferAccountHolder = paymentSettings.BankTransferAccountHolder,
                MBReferenceEnabled = paymentSettings.MBReferenceEnabled,
                MBReferenceEntity = paymentSettings.MBReferenceEntity,
                MBReferenceReference = paymentSettings.MBReferenceReference,
                MBWayEnabled = paymentSettings.MBWayEnabled,
                MBWayPhoneNumber = paymentSettings.MBWayPhoneNumber,
                CardEnabled = paymentSettings.CardEnabled,
                CardProvider = paymentSettings.CardProvider,
                CardPublicKey = paymentSettings.CardPublicKey
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting payment methods for condominium {CondominiumId}: {Message}", condominiumId, ex.Message);
            return StatusCode(500, new { 
                message = ex.Message, 
                innerException = ex.InnerException?.Message,
                stackTrace = ex.StackTrace 
            });
        }
    }
}

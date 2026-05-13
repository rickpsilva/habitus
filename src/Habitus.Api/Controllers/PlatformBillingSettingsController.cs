using Habitus.Application.DTOs.Billing;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/platform/billing-settings")]
[Authorize(Roles = "Manager")]
public class PlatformBillingSettingsController : ControllerBase
{
    private readonly IRepository<PlatformBillingSettings> _repository;
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<PlatformBillingSettingsController> _logger;

    public PlatformBillingSettingsController(
        IRepository<PlatformBillingSettings> repository,
        IEncryptionService encryptionService,
        ILogger<PlatformBillingSettingsController> logger)
    {
        _repository = repository;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        try
        {
            var settings = (await _repository.GetAllAsync()).FirstOrDefault();
            if (settings == null)
            {
                return Ok(new PlatformBillingSettingsDto
                {
                    Id = Guid.Empty,
                    GatewayEnabled = false,
                    GatewayProvider = "stripe",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            return Ok(Map(settings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving platform billing settings");
            return StatusCode(500, new { message = "Erro ao obter configurações de faturação da plataforma." });
        }
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdatePlatformBillingSettingsRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.GatewayProvider))
                return BadRequest("Gateway provider is required");

            var settings = (await _repository.GetAllAsync()).FirstOrDefault();
            var isNew = settings == null;
            settings ??= new PlatformBillingSettings
            {
                Id = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow
            };

            settings.GatewayEnabled = request.GatewayEnabled;
            settings.GatewayProvider = request.GatewayProvider.Trim().ToLowerInvariant();
            settings.PublicKey = string.IsNullOrWhiteSpace(request.PublicKey) ? null : request.PublicKey.Trim();
            settings.MerchantDisplayName = string.IsNullOrWhiteSpace(request.MerchantDisplayName)
                ? null
                : request.MerchantDisplayName.Trim();

            if (!string.IsNullOrWhiteSpace(request.SecretKey))
            {
                settings.SecretKeyEncrypted = _encryptionService.Encrypt(request.SecretKey.Trim());
            }

            if (!string.IsNullOrWhiteSpace(request.WebhookSecret))
            {
                settings.WebhookSecretEncrypted = _encryptionService.Encrypt(request.WebhookSecret.Trim());
            }

            settings.UpdatedAt = DateTime.UtcNow;

            if (isNew)
            {
                await _repository.AddAsync(settings);
            }
            else
            {
                _repository.Update(settings);
            }

            await _repository.SaveChangesAsync();
            return Ok(Map(settings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating platform billing settings");
            return StatusCode(500, new { message = "Erro ao atualizar configurações de faturação da plataforma." });
        }
    }

    private static PlatformBillingSettingsDto Map(PlatformBillingSettings settings)
    {
        return new PlatformBillingSettingsDto
        {
            Id = settings.Id,
            GatewayEnabled = settings.GatewayEnabled,
            GatewayProvider = settings.GatewayProvider,
            PublicKey = settings.PublicKey,
            MerchantDisplayName = settings.MerchantDisplayName,
            HasSecretKey = !string.IsNullOrWhiteSpace(settings.SecretKeyEncrypted),
            HasWebhookSecret = !string.IsNullOrWhiteSpace(settings.WebhookSecretEncrypted),
            CreatedAt = settings.CreatedAt,
            UpdatedAt = settings.UpdatedAt
        };
    }
}

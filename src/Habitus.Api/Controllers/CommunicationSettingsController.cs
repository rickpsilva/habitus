using Habitus.Application.DTOs.Communication;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId}/communication-settings")]
[Authorize(Roles = "Admin,Manager")]
public class CommunicationSettingsController : ControllerBase
{
    private readonly IRepository<CommunicationSettings> _repository;
    private readonly ILogger<CommunicationSettingsController> _logger;

    public CommunicationSettingsController(
        IRepository<CommunicationSettings> repository,
        ILogger<CommunicationSettingsController> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    /// <summary>
    /// Get communication settings for a condominium
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(Guid condominiumId)
    {
        try
        {
            var settings = await _repository.FindAsync(cs => cs.CondominiumId == condominiumId);
            var communicationSettings = settings.FirstOrDefault();

            if (communicationSettings == null)
            {
                // Return default settings if none exist
                return Ok(new CommunicationSettingsDto
                {
                    Id = Guid.Empty,
                    CondominiumId = condominiumId,
                    EmailEnabled = false,
                    EmailSmtpHost = null,
                    EmailSmtpPort = 587,
                    EmailUsername = null,
                    EmailFromAddress = null,
                    EmailFromName = null,
                    EmailUseSsl = true,
                    WhatsAppEnabled = false,
                    WhatsAppPhoneNumber = null,
                    WhatsAppApiProvider = null,
                    WhatsAppGroupId = null,
                    SmsEnabled = false,
                    SmsProvider = null,
                    SmsFromNumber = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            var dto = new CommunicationSettingsDto
            {
                Id = communicationSettings.Id,
                CondominiumId = communicationSettings.CondominiumId,
                EmailEnabled = communicationSettings.EmailEnabled,
                EmailSmtpHost = communicationSettings.EmailSmtpHost,
                EmailSmtpPort = communicationSettings.EmailSmtpPort,
                EmailUsername = communicationSettings.EmailUsername,
                EmailFromAddress = communicationSettings.EmailFromAddress,
                EmailFromName = communicationSettings.EmailFromName,
                EmailUseSsl = communicationSettings.EmailUseSsl,
                WhatsAppEnabled = communicationSettings.WhatsAppEnabled,
                WhatsAppPhoneNumber = communicationSettings.WhatsAppPhoneNumber,
                WhatsAppApiProvider = communicationSettings.WhatsAppApiProvider,
                WhatsAppGroupId = communicationSettings.WhatsAppGroupId,
                SmsEnabled = communicationSettings.SmsEnabled,
                SmsProvider = communicationSettings.SmsProvider,
                SmsFromNumber = communicationSettings.SmsFromNumber,
                CreatedAt = communicationSettings.CreatedAt,
                UpdatedAt = communicationSettings.UpdatedAt
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting communication settings for condominium {CondominiumId}", condominiumId);
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update communication settings for a condominium
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> Update(Guid condominiumId, [FromBody] UpdateCommunicationSettingsRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var settings = await _repository.FindAsync(cs => cs.CondominiumId == condominiumId);
            var communicationSettings = settings.FirstOrDefault();

            bool isNew = false;
            if (communicationSettings == null)
            {
                // Create new settings
                isNew = true;
                communicationSettings = new CommunicationSettings
                {
                    Id = Guid.NewGuid(),
                    CondominiumId = condominiumId,
                    CreatedAt = DateTime.UtcNow
                };
            }

            // Update Email fields
            communicationSettings.EmailEnabled = request.EmailEnabled;
            communicationSettings.EmailSmtpHost = request.EmailSmtpHost;
            communicationSettings.EmailSmtpPort = request.EmailSmtpPort;
            communicationSettings.EmailUsername = request.EmailUsername;
            communicationSettings.EmailFromAddress = request.EmailFromAddress;
            communicationSettings.EmailFromName = request.EmailFromName;
            communicationSettings.EmailUseSsl = request.EmailUseSsl;
            
            // Only update password if provided
            if (!string.IsNullOrWhiteSpace(request.EmailPassword))
            {
                // TODO: Encrypt the password before storing in production
                communicationSettings.EmailPassword = request.EmailPassword;
            }
            
            // Update WhatsApp fields
            communicationSettings.WhatsAppEnabled = request.WhatsAppEnabled;
            communicationSettings.WhatsAppPhoneNumber = request.WhatsAppPhoneNumber;
            communicationSettings.WhatsAppApiProvider = request.WhatsAppApiProvider;
            communicationSettings.WhatsAppGroupId = request.WhatsAppGroupId;
            
            // Only update API key if provided
            if (!string.IsNullOrWhiteSpace(request.WhatsAppApiKey))
            {
                // TODO: Encrypt the API key before storing in production
                communicationSettings.WhatsAppApiKey = request.WhatsAppApiKey;
            }
            
            // Update SMS fields
            communicationSettings.SmsEnabled = request.SmsEnabled;
            communicationSettings.SmsProvider = request.SmsProvider;
            communicationSettings.SmsFromNumber = request.SmsFromNumber;
            
            // Only update SMS API key if provided
            if (!string.IsNullOrWhiteSpace(request.SmsApiKey))
            {
                // TODO: Encrypt the API key before storing in production
                communicationSettings.SmsApiKey = request.SmsApiKey;
            }
            
            communicationSettings.UpdatedAt = DateTime.UtcNow;

            if (isNew)
            {
                await _repository.AddAsync(communicationSettings);
            }
            else
            {
                _repository.Update(communicationSettings);
            }
            
            await _repository.SaveChangesAsync();

            var dto = new CommunicationSettingsDto
            {
                Id = communicationSettings.Id,
                CondominiumId = communicationSettings.CondominiumId,
                EmailEnabled = communicationSettings.EmailEnabled,
                EmailSmtpHost = communicationSettings.EmailSmtpHost,
                EmailSmtpPort = communicationSettings.EmailSmtpPort,
                EmailUsername = communicationSettings.EmailUsername,
                EmailFromAddress = communicationSettings.EmailFromAddress,
                EmailFromName = communicationSettings.EmailFromName,
                EmailUseSsl = communicationSettings.EmailUseSsl,
                WhatsAppEnabled = communicationSettings.WhatsAppEnabled,
                WhatsAppPhoneNumber = communicationSettings.WhatsAppPhoneNumber,
                WhatsAppApiProvider = communicationSettings.WhatsAppApiProvider,
                WhatsAppGroupId = communicationSettings.WhatsAppGroupId,
                SmsEnabled = communicationSettings.SmsEnabled,
                SmsProvider = communicationSettings.SmsProvider,
                SmsFromNumber = communicationSettings.SmsFromNumber,
                CreatedAt = communicationSettings.CreatedAt,
                UpdatedAt = communicationSettings.UpdatedAt
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating communication settings for condominium {CondominiumId}", condominiumId);
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

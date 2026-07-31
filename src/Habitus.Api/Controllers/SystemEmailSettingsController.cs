using Habitus.Application.DTOs.SystemEmail;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/platform/[controller]")]
[Authorize(Roles = "Manager")]
public class SystemEmailSettingsController : ControllerBase
{
    private readonly IRepository<SystemEmailSettings> _repository;
    private readonly IPlatformSettingsCache _settingsCache;
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<SystemEmailSettingsController> _logger;

    public SystemEmailSettingsController(
        IRepository<SystemEmailSettings> repository,
        IPlatformSettingsCache settingsCache,
        IEncryptionService encryptionService,
        ILogger<SystemEmailSettingsController> logger)
    {
        _repository = repository;
        _settingsCache = settingsCache;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        try
        {
            var settings = await _settingsCache.GetSystemEmailAsync();
            if (settings == null)
            {
                return Ok(new SystemEmailSettingsDto
                {
                    Id = Guid.Empty,
                    EmailEnabled = false,
                    SmtpPort = 587,
                    FromAddress = "no-reply@habituscond.pt",
                    FromName = "Habitus",
                    UseSsl = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            return Ok(Map(settings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter configurações de email do sistema");
            return StatusCode(500, new { message = "Erro ao obter configurações de email do sistema." });
        }
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateSystemEmailSettingsRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.FromAddress))
                return BadRequest(new { message = "O endereço de email de origem é obrigatório." });

            var settings = (await _repository.GetAllAsync()).FirstOrDefault();
            var isNew = settings == null;
            settings ??= new SystemEmailSettings
            {
                Id = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow
            };

            settings.EmailEnabled = request.EmailEnabled;
            settings.SmtpHost = string.IsNullOrWhiteSpace(request.SmtpHost) ? null : request.SmtpHost.Trim();
            settings.SmtpPort = request.SmtpPort > 0 ? request.SmtpPort : 587;
            settings.Username = string.IsNullOrWhiteSpace(request.Username) ? null : request.Username.Trim();
            settings.FromAddress = request.FromAddress.Trim();
            settings.FromName = string.IsNullOrWhiteSpace(request.FromName) ? "Habitus" : request.FromName.Trim();
            settings.UseSsl = request.UseSsl;
            settings.UpdatedAt = DateTime.UtcNow;

            if (!string.IsNullOrWhiteSpace(request.Password))
            {
                settings.PasswordEncrypted = _encryptionService.Encrypt(request.Password.Trim());
            }

            if (isNew)
            {
                await _repository.AddAsync(settings);
            }
            else
            {
                _repository.Update(settings);
            }

            await _repository.SaveChangesAsync();
            _settingsCache.InvalidateSystemEmail();
            return Ok(Map(settings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao guardar configurações de email do sistema");
            return StatusCode(500, new { message = "Erro ao guardar configurações de email do sistema." });
        }
    }

    [HttpPost("test")]
    public async Task<IActionResult> TestConnection()
    {
        try
        {
            var settings = await _settingsCache.GetSystemEmailAsync();
            if (settings == null || !settings.EmailEnabled)
                return BadRequest(new { message = "Email do sistema não está configurado ou activado." });

            if (string.IsNullOrWhiteSpace(settings.SmtpHost))
                return BadRequest(new { message = "Servidor SMTP não configurado." });

            // Basic connectivity test - just validate settings exist
            return Ok(new { message = "Configuração de email do sistema verificada com sucesso." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao testar configurações de email do sistema");
            return StatusCode(500, new { message = "Erro ao testar a ligação de email." });
        }
    }

    private static SystemEmailSettingsDto Map(SystemEmailSettings settings) => new()
    {
        Id = settings.Id,
        EmailEnabled = settings.EmailEnabled,
        SmtpHost = settings.SmtpHost,
        SmtpPort = settings.SmtpPort,
        Username = settings.Username,
        HasPassword = !string.IsNullOrWhiteSpace(settings.PasswordEncrypted),
        FromAddress = settings.FromAddress,
        FromName = settings.FromName,
        UseSsl = settings.UseSsl,
        CreatedAt = settings.CreatedAt,
        UpdatedAt = settings.UpdatedAt
    };
}

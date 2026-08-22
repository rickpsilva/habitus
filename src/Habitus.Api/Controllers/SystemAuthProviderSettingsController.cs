using Habitus.Application.DTOs.SystemAuthProvider;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/platform/[controller]")]
public class SystemAuthProviderSettingsController : ControllerBase
{
    private readonly IRepository<SystemAuthProviderSettings> _repository;
    private readonly IPlatformSettingsCache _settingsCache;
    private readonly ILogger<SystemAuthProviderSettingsController> _logger;

    public SystemAuthProviderSettingsController(
        IRepository<SystemAuthProviderSettings> repository,
        IPlatformSettingsCache settingsCache,
        ILogger<SystemAuthProviderSettingsController> logger)
    {
        _repository = repository;
        _settingsCache = settingsCache;
        _logger = logger;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get()
    {
        try
        {
            var settings = await _settingsCache.GetSystemAuthProviderAsync();
            if (settings == null)
            {
                return Ok(new SystemAuthProviderSettingsDto
                {
                    Id = Guid.Empty,
                    GoogleEnabled = true,
                    MicrosoftEnabled = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            return Ok(Map(settings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter configurações de provedores de autenticação");
            return StatusCode(500, new { message = "Erro ao obter configurações de provedores de autenticação." });
        }
    }

    [HttpPut]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Update([FromBody] UpdateSystemAuthProviderSettingsRequest request)
    {
        try
        {
            var settings = (await _repository.GetAllAsync()).FirstOrDefault();
            var isNew = settings == null;
            settings ??= new SystemAuthProviderSettings
            {
                Id = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow
            };

            settings.GoogleEnabled = request.GoogleEnabled;
            settings.MicrosoftEnabled = request.MicrosoftEnabled;
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
            _settingsCache.InvalidateSystemAuthProvider();

            return Ok(Map(settings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao atualizar configurações de provedores de autenticação");
            return StatusCode(500, new { message = "Erro ao atualizar configurações de provedores de autenticação." });
        }
    }

    private static SystemAuthProviderSettingsDto Map(SystemAuthProviderSettings settings) => new()
    {
        Id = settings.Id,
        GoogleEnabled = settings.GoogleEnabled,
        MicrosoftEnabled = settings.MicrosoftEnabled,
        CreatedAt = settings.CreatedAt,
        UpdatedAt = settings.UpdatedAt
    };
}
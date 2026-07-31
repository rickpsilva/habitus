using Habitus.Application.DTOs.Uploads;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/platform/[controller]")]
[Authorize]
public class UploadSettingsController : ControllerBase
{
    private const int DefaultMaxUploadSizeBytes = 600 * 1024;
    private const int MinimumMaxUploadSizeBytes = 50 * 1024;
    private const int MaximumMaxUploadSizeBytes = 500 * 1024 * 1024;

    private readonly IRepository<PlatformUploadSettings> _repository;
    private readonly IPlatformSettingsCache _settingsCache;
    private readonly ILogger<UploadSettingsController> _logger;

    public UploadSettingsController(
        IRepository<PlatformUploadSettings> repository,
        IPlatformSettingsCache settingsCache,
        ILogger<UploadSettingsController> logger)
    {
        _repository = repository;
        _settingsCache = settingsCache;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        try
        {
            var settings = await _settingsCache.GetUploadAsync();
            if (settings == null)
            {
                return Ok(new PlatformUploadSettingsDto
                {
                    Id = Guid.Empty,
                    MaxUploadSizeBytes = DefaultMaxUploadSizeBytes,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            }

            return Ok(Map(settings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving platform upload settings");
            return StatusCode(500, new { message = "Erro ao obter configurações de upload." });
        }
    }

    [HttpPut]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Update([FromBody] UpdatePlatformUploadSettingsRequest request)
    {
        try
        {
            if (request.MaxUploadSizeBytes < MinimumMaxUploadSizeBytes || request.MaxUploadSizeBytes > MaximumMaxUploadSizeBytes)
            {
                return BadRequest(new
                {
                    message = $"O tamanho máximo deve estar entre {FormatFileSize(MinimumMaxUploadSizeBytes)} e {FormatFileSize(MaximumMaxUploadSizeBytes)}."
                });
            }

            var settings = (await _repository.GetAllAsync()).FirstOrDefault();
            var isNew = settings == null;

            settings ??= new PlatformUploadSettings
            {
                Id = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow,
            };

            settings.MaxUploadSizeBytes = request.MaxUploadSizeBytes;
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
            _settingsCache.InvalidateUpload();
            return Ok(Map(settings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating platform upload settings");
            return StatusCode(500, new { message = "Erro ao atualizar configurações de upload." });
        }
    }

    private static PlatformUploadSettingsDto Map(PlatformUploadSettings settings)
    {
        return new PlatformUploadSettingsDto
        {
            Id = settings.Id,
            MaxUploadSizeBytes = settings.MaxUploadSizeBytes,
            CreatedAt = settings.CreatedAt,
            UpdatedAt = settings.UpdatedAt,
        };
    }

    private static string FormatFileSize(long bytes)
    {
        const double kb = 1024;
        const double mb = 1024 * 1024;

        if (bytes >= mb)
        {
            return $"{bytes / mb:0.##} MB";
        }

        return $"{bytes / kb:0.##} KB";
    }
}
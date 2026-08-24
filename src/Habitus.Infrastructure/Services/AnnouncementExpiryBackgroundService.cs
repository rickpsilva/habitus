using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Background service that automatically archives expired announcements.
/// Runs daily at a configured time (default: 03:00 AM)
/// </summary>
public class AnnouncementExpiryBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AnnouncementExpiryBackgroundService> _logger;
    private readonly IConfiguration _configuration;

    public AnnouncementExpiryBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<AnnouncementExpiryBackgroundService> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Announcement Expiry Background Service starting...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var runTime = GetNextRunTime();
                var delay = runTime - DateTime.Now;

                if (delay.TotalSeconds <= 0)
                {
                    // Run immediately if past the scheduled time
                    await ArchiveExpiredAnnouncementsAsync(stoppingToken);
                    // Next run tomorrow
                    delay = TimeSpan.FromHours(24);
                }

                _logger.LogInformation("Next announcement expiry check scheduled for {NextRun}", runTime);
                await Task.Delay(delay, stoppingToken);

                if (!stoppingToken.IsCancellationRequested)
                {
                    await ArchiveExpiredAnnouncementsAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Announcement Expiry Background Service is stopping");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Announcement Expiry Background Service");
                // Wait 1 hour before retrying on error
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }
    }

    private async Task ArchiveExpiredAnnouncementsAsync(CancellationToken cancellationToken)
    {
        try
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var announcementService = scope.ServiceProvider.GetRequiredService<IAnnouncementService>();
                
                _logger.LogInformation("Starting automatic announcement expiry check...");
                var archivedCount = await announcementService.ArchiveExpiredAnnouncementsAsync(cancellationToken);
                
                if (archivedCount > 0)
                {
                    _logger.LogInformation("Successfully archived {ArchivedCount} expired announcements", archivedCount);
                }
                else
                {
                    _logger.LogDebug("No announcements were due for archival");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during automatic announcement archival");
        }
    }

    private DateTime GetNextRunTime()
    {
        // Get configured run time (default: 03:00 AM)
        var configuredTime = _configuration["Announcements:ExpiryJob:RunTime"] ?? "03:00";
        
        if (TimeSpan.TryParse(configuredTime, out var timeOfDay))
        {
            var nextRun = DateTime.Today.Add(timeOfDay);
            if (nextRun <= DateTime.Now)
            {
                nextRun = nextRun.AddDays(1);
            }
            return nextRun;
        }

        // Fallback to 03:00 AM
        var fallback = DateTime.Today.AddHours(3);
        if (fallback <= DateTime.Now)
        {
            fallback = fallback.AddDays(1);
        }
        return fallback;
    }
}
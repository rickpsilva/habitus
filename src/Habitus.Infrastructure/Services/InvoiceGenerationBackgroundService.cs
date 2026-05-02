using Habitus.Application.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Background service that automatically generates invoices for due subscriptions.
/// Runs daily at a configured time (default: 02:00 AM)
/// </summary>
public class InvoiceGenerationBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<InvoiceGenerationBackgroundService> _logger;
    private readonly IConfiguration _configuration;

    public InvoiceGenerationBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<InvoiceGenerationBackgroundService> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Invoice Generation Background Service starting...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var runTime = GetNextRunTime();
                var delay = runTime - DateTime.Now;

                if (delay.TotalSeconds <= 0)
                {
                    // Run immediately if past the scheduled time
                    await GenerateInvoicesAsync(stoppingToken);
                    // Next run tomorrow
                    delay = TimeSpan.FromHours(24);
                }

                _logger.LogInformation("Next invoice generation scheduled for {NextRun}", runTime);
                await Task.Delay(delay, stoppingToken);

                if (!stoppingToken.IsCancellationRequested)
                {
                    await GenerateInvoicesAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Invoice Generation Background Service is stopping");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Invoice Generation Background Service");
                // Wait 1 hour before retrying on error
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }
    }

    private async Task GenerateInvoicesAsync(CancellationToken cancellationToken)
    {
        try
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var invoiceService = scope.ServiceProvider.GetRequiredService<InvoiceService>();
                
                _logger.LogInformation("Starting automatic invoice generation...");
                var generatedCount = await invoiceService.GenerateDueInvoicesAsync(null);
                
                if (generatedCount > 0)
                {
                    _logger.LogInformation("Successfully generated {InvoiceCount} invoices", generatedCount);
                }
                else
                {
                    _logger.LogDebug("No invoices were due for generation");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during automatic invoice generation");
        }
    }

    private DateTime GetNextRunTime()
    {
        // Get configured run time (default: 02:00 AM)
        var configuredTime = _configuration["Billing:InvoiceGenerationTime"] ?? "02:00";
        if (!TimeOnly.TryParse(configuredTime, out var scheduledTime))
        {
            scheduledTime = TimeOnly.Parse("02:00");
        }

        var now = DateTime.Now;
        var nextRun = now.Date.Add(scheduledTime.ToTimeSpan());

        // If scheduled time has already passed today, schedule for tomorrow
        if (nextRun <= now)
        {
            nextRun = nextRun.AddDays(1);
        }

        return nextRun;
    }
}

using Habitus.Application.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Habitus.Application.Interfaces;

namespace Habitus.Infrastructure.Services;

public class RgpdMigrationWorkerHostedService : BackgroundService
{
    private readonly IRgpdMigrationJobQueue _queue;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<RgpdMigrationWorkerHostedService> _logger;

    public RgpdMigrationWorkerHostedService(
        IRgpdMigrationJobQueue queue,
        IServiceProvider serviceProvider,
        ILogger<RgpdMigrationWorkerHostedService> logger)
    {
        _queue = queue;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var runId in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var operations = scope.ServiceProvider.GetRequiredService<RgpdMigrationOperationsService>();
                await operations.ProcessRunAsync(runId, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while processing RGPD migration run {RunId}", runId);
            }
        }
    }
}

using Habitus.Application.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

public class HistoricalEncryptionBackfillHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<HistoricalEncryptionBackfillHostedService> _logger;

    public HistoricalEncryptionBackfillHostedService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<HistoricalEncryptionBackfillHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var enabled = _configuration.GetValue<bool?>("Rgpd:EnableHistoricalBackfill") ?? true;
        if (!enabled)
        {
            _logger.LogInformation("RGPD historical encryption backfill is disabled by configuration.");
            return;
        }

        using var scope = _serviceProvider.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<HistoricalEncryptionBackfillService>();

        var result = await service.RunAsync(cancellationToken);

        _logger.LogInformation(
            "RGPD historical backfill finished. CondominiumUpdated={CondoUpdated}, InvoiceUpdated={InvoiceUpdated}, Encrypted={Encrypted}, LegacyCleared={Cleared}",
            result.CondominiumRecordsUpdated,
            result.InvoiceRecordsUpdated,
            result.ValuesEncrypted,
            result.LegacyValuesCleared);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

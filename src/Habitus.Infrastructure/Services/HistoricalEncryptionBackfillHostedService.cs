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

        var audit = await service.AuditRemainingLegacyPlaintextAsync(cancellationToken);
        if (audit.TotalRemaining > 0)
        {
            _logger.LogWarning(
                "RGPD legacy plaintext still present after backfill. Total={Total}, CondoTaxId={CondoTaxId}, CondoIban={CondoIban}, CondoAddress={CondoAddress}, InvoiceTaxId={InvoiceTaxId}, InvoiceAddress={InvoiceAddress}",
                audit.TotalRemaining,
                audit.CondominiumTaxIdLegacyCount,
                audit.CondominiumPaymentIbanLegacyCount,
                audit.CondominiumAddressLegacyCount,
                audit.InvoiceCustomerTaxIdLegacyCount,
                audit.InvoiceCustomerAddressLegacyCount);
        }
        else
        {
            _logger.LogInformation("RGPD legacy plaintext audit passed: no plaintext values remaining in audited fields.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

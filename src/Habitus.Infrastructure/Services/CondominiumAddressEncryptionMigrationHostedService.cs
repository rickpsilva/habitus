using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

public class CondominiumAddressEncryptionMigrationHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CondominiumAddressEncryptionMigrationHostedService> _logger;

    public CondominiumAddressEncryptionMigrationHostedService(
        IServiceProvider serviceProvider,
        ILogger<CondominiumAddressEncryptionMigrationHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var condominiumRepository = scope.ServiceProvider.GetRequiredService<IRepository<Condominium>>();
        var encryptionService = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

        try
        {
            var condominiumsToMigrate = await condominiumRepository.FindAsync(c =>
                (string.IsNullOrEmpty(c.AddressEncrypted) && !string.IsNullOrWhiteSpace(c.Address)) ||
                (string.IsNullOrEmpty(c.EmailEncrypted) && !string.IsNullOrWhiteSpace(c.Email)));

            var migratedCount = 0;
            foreach (var condominium in condominiumsToMigrate)
            {
                var shouldUpdate = false;

                var plainAddress = condominium.Address?.Trim();
                if (string.IsNullOrEmpty(condominium.AddressEncrypted) && !string.IsNullOrWhiteSpace(plainAddress))
                {
                    condominium.AddressEncrypted = encryptionService.Encrypt(plainAddress);
                    condominium.Address = string.Empty;
                    shouldUpdate = true;
                }

                var plainEmail = condominium.Email?.Trim();
                if (string.IsNullOrEmpty(condominium.EmailEncrypted) && !string.IsNullOrWhiteSpace(plainEmail))
                {
                    condominium.EmailEncrypted = encryptionService.Encrypt(plainEmail);
                    condominium.Email = string.Empty;
                    shouldUpdate = true;
                }

                if (!shouldUpdate)
                {
                    continue;
                }

                condominiumRepository.Update(condominium);
                migratedCount++;
            }

            if (migratedCount > 0)
            {
                await condominiumRepository.SaveChangesAsync();
                _logger.LogInformation("Migrated encrypted address/email for {Count} condominiums.", migratedCount);
            }
            else
            {
                _logger.LogDebug("No condominiums require address/email encryption migration.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Condominium address/email encryption migration failed.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

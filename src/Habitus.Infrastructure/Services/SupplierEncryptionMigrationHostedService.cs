using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

public class SupplierEncryptionMigrationHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SupplierEncryptionMigrationHostedService> _logger;

    public SupplierEncryptionMigrationHostedService(
        IServiceProvider serviceProvider,
        ILogger<SupplierEncryptionMigrationHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var supplierRepository = scope.ServiceProvider.GetRequiredService<IRepository<Supplier>>();
        var encryptionService = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

        try
        {
            var suppliersToMigrate = await supplierRepository.FindAsync(s =>
                (string.IsNullOrEmpty(s.EmailEncrypted) && !string.IsNullOrWhiteSpace(s.Email)) ||
                (string.IsNullOrEmpty(s.PhoneEncrypted) && !string.IsNullOrWhiteSpace(s.Phone)) ||
                (string.IsNullOrEmpty(s.AddressEncrypted) && !string.IsNullOrWhiteSpace(s.Address)));

            var migratedCount = 0;
            foreach (var supplier in suppliersToMigrate)
            {
                var shouldUpdate = false;

                var plainEmail = supplier.Email?.Trim();
                if (string.IsNullOrEmpty(supplier.EmailEncrypted) && !string.IsNullOrWhiteSpace(plainEmail))
                {
                    supplier.EmailEncrypted = encryptionService.Encrypt(plainEmail);
                    supplier.Email = string.Empty;
                    shouldUpdate = true;
                }

                var plainPhone = supplier.Phone?.Trim();
                if (string.IsNullOrEmpty(supplier.PhoneEncrypted) && !string.IsNullOrWhiteSpace(plainPhone))
                {
                    supplier.PhoneEncrypted = encryptionService.Encrypt(plainPhone);
                    supplier.Phone = string.Empty;
                    shouldUpdate = true;
                }

                var plainAddress = supplier.Address?.Trim();
                if (string.IsNullOrEmpty(supplier.AddressEncrypted) && !string.IsNullOrWhiteSpace(plainAddress))
                {
                    supplier.AddressEncrypted = encryptionService.Encrypt(plainAddress);
                    supplier.Address = string.Empty;
                    shouldUpdate = true;
                }

                if (!shouldUpdate)
                {
                    continue;
                }

                supplierRepository.Update(supplier);
                migratedCount++;
            }

            if (migratedCount > 0)
            {
                await supplierRepository.SaveChangesAsync();
                _logger.LogInformation("Migrated encrypted fields for {Count} suppliers.", migratedCount);
            }
            else
            {
                _logger.LogDebug("No suppliers require encryption migration.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Supplier encryption migration failed.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

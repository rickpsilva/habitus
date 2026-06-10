using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

public class UsefulContactEncryptionMigrationHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<UsefulContactEncryptionMigrationHostedService> _logger;

    public UsefulContactEncryptionMigrationHostedService(
        IServiceProvider serviceProvider,
        ILogger<UsefulContactEncryptionMigrationHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var contactRepository = scope.ServiceProvider.GetRequiredService<IRepository<UsefulContact>>();
        var encryptionService = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

        try
        {
            var contactsToMigrate = await contactRepository.FindAsync(c =>
                string.IsNullOrEmpty(c.PhoneEncrypted) && !string.IsNullOrWhiteSpace(c.Phone));

            var migratedCount = 0;
            foreach (var contact in contactsToMigrate)
            {
                var shouldUpdate = false;

                var plainPhone = contact.Phone?.Trim();
                if (string.IsNullOrEmpty(contact.PhoneEncrypted) && !string.IsNullOrWhiteSpace(plainPhone))
                {
                    contact.PhoneEncrypted = encryptionService.Encrypt(plainPhone);
                    contact.Phone = string.Empty;
                    shouldUpdate = true;
                }

                if (!shouldUpdate)
                {
                    continue;
                }

                contactRepository.Update(contact);
                migratedCount++;
            }

            if (migratedCount > 0)
            {
                await contactRepository.SaveChangesAsync();
                _logger.LogInformation("Migrated encrypted data for {Count} useful contacts.", migratedCount);
            }
            else
            {
                _logger.LogDebug("No useful contacts require data encryption migration.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Useful contact data encryption migration failed.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

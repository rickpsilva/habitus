using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

public class UserPhoneEncryptionMigrationHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<UserPhoneEncryptionMigrationHostedService> _logger;

    public UserPhoneEncryptionMigrationHostedService(
        IServiceProvider serviceProvider,
        ILogger<UserPhoneEncryptionMigrationHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var userRepository = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        var encryptionService = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

        try
        {
            var usersToMigrate = await userRepository.FindAsync(
                u => string.IsNullOrEmpty(u.PhoneEncrypted) && !string.IsNullOrEmpty(u.Phone));

            var migratedCount = 0;
            foreach (var user in usersToMigrate)
            {
                user.PhoneEncrypted = encryptionService.Encrypt(user.Phone.Trim());
                user.Phone = string.Empty;
                userRepository.Update(user);
                migratedCount++;
            }

            if (migratedCount > 0)
            {
                await userRepository.SaveChangesAsync();
                _logger.LogInformation("Migrated encrypted phone for {Count} users.", migratedCount);
            }
            else
            {
                _logger.LogDebug("No users require phone encryption migration.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "User phone encryption migration failed.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

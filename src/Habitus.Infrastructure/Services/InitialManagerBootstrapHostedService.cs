using Habitus.Application.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

public class InitialManagerBootstrapHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<InitialManagerBootstrapHostedService> _logger;

    public InitialManagerBootstrapHostedService(
        IServiceProvider serviceProvider,
        ILogger<InitialManagerBootstrapHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<AuthService>();

        try
        {
            var result = await authService.EnsureInitialManagerAsync();
            switch (result)
            {
                case InitialManagerBootstrapStatus.Created:
                    _logger.LogInformation("Initial Manager account created successfully.");
                    break;
                case InitialManagerBootstrapStatus.ManagerAlreadyExists:
                    _logger.LogDebug("Initial Manager bootstrap skipped because a Manager already exists.");
                    break;
                case InitialManagerBootstrapStatus.EmailAlreadyExists:
                    _logger.LogWarning("Initial Manager bootstrap skipped because the configured email already exists with another account.");
                    break;
                case InitialManagerBootstrapStatus.MissingConfiguration:
                    _logger.LogDebug("Initial Manager bootstrap skipped because required configuration is missing.");
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Initial Manager bootstrap failed.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// A <see cref="WebApplicationFactory{TEntryPoint}"/> that isolates the integration suite from
/// the shared dev <c>habitus</c> database. It keeps the Development environment (so behaviour
/// matches the running app) but overrides <c>ConnectionStrings:DefaultConnection</c> so every
/// test connects to a DEDICATED <c>habitus_test</c> database on the same server/credentials.
/// On first use it applies all EF Core migrations (creating <c>habitus_test</c> if missing),
/// exactly once per test run, so the dev data is never touched or polluted.
/// </summary>
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    /// <summary>Dedicated test connection string — same server/credentials, different database.</summary>
    public const string TestConnectionString =
        "Host=host.docker.internal;Port=5432;Database=habitus_test;Username=habitus;Password=habitus";

    // Ensures Database.Migrate() runs only once for the whole test run, regardless of how many
    // test classes/instances resolve the factory.
    private static readonly object MigrateLock = new();
    private static bool _migrated;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Keep existing behaviour: run as Development, but force the dedicated test database.
        builder.UseEnvironment("Development");

        // Overriding the connection string via configuration is not reliable here because the
        // app reads it at DI-registration time; instead we replace the DbContext registration
        // itself so it unconditionally targets habitus_test. This is applied AFTER the app's own
        // ConfigureServices, so it wins.
        builder.ConfigureServices(services =>
        {
            // The app registers a pooled DbContext (AddDbContextPool). Remove every
            // DbContext/pool-related descriptor before re-registering a plain (non-pooled)
            // AddDbContext that targets habitus_test. Removing only DbContextOptions would
            // leave the singleton IDbContextPool bound to now-scoped options and fail
            // DI validation.
            var descriptorsToRemove = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<HabitusDbContext>) ||
                d.ServiceType == typeof(DbContextOptions) ||
                d.ServiceType == typeof(HabitusDbContext) ||
                (d.ServiceType.IsGenericType &&
                 (d.ServiceType.GetGenericTypeDefinition().Name.StartsWith("IDbContextPool") ||
                  d.ServiceType.GetGenericTypeDefinition().Name.StartsWith("IScopedDbContextLease") ||
                  d.ServiceType.GetGenericTypeDefinition().Name.StartsWith("IDbContextFactory"))))
                .ToList();
            foreach (var descriptor in descriptorsToRemove)
                services.Remove(descriptor);

            services.AddDbContext<HabitusDbContext>(options =>
                options.UseNpgsql(TestConnectionString,
                    b => b.MigrationsAssembly("Habitus.Infrastructure")));

            // The production IPlatformSettingsCache is backed by the singleton IMemoryCache, which
            // would leak cached settings across tests that share this factory and seed rows directly
            // through the DbContext (bypassing the API write paths that invalidate the cache).
            // Replace it with a non-caching pass-through so every read hits the test database.
            var cacheDescriptor = services.FirstOrDefault(d => d.ServiceType == typeof(IPlatformSettingsCache));
            if (cacheDescriptor != null)
                services.Remove(cacheDescriptor);
            services.AddScoped<IPlatformSettingsCache, PassthroughPlatformSettingsCache>();
        });

        base.ConfigureWebHost(builder);
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        EnsureDatabaseMigrated(host);
        return host;
    }

    /// <summary>Creates and migrates <c>habitus_test</c> once, using the app's own DbContext.</summary>
    private static void EnsureDatabaseMigrated(IHost host)
    {
        if (_migrated)
            return;

        lock (MigrateLock)
        {
            if (_migrated)
                return;

            using var scope = host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

            // Guardrail: never migrate anything other than the dedicated test database.
            if (db.Database.GetDbConnection().Database != "habitus_test")
            {
                throw new InvalidOperationException(
                    $"Refusing to migrate: integration tests are pointed at " +
                    $"'{db.Database.GetDbConnection().Database}', not 'habitus_test'.");
            }

            db.Database.Migrate();
            _migrated = true;
        }
    }
}

/// <summary>
/// Test-only <see cref="IPlatformSettingsCache"/> that always reads the current single row from the
/// database (no caching, no cross-test state) so integration tests that seed settings directly via
/// the DbContext observe their own data. Invalidation is a no-op because nothing is cached.
/// </summary>
internal sealed class PassthroughPlatformSettingsCache : IPlatformSettingsCache
{
    private readonly IRepository<LocalizationSettings> _localizationRepository;
    private readonly IRepository<PlatformBillingSettings> _billingRepository;
    private readonly IRepository<SystemEmailSettings> _systemEmailRepository;
    private readonly IRepository<PlatformUploadSettings> _uploadRepository;
    private readonly IRepository<SystemAuthProviderSettings> _systemAuthProviderRepository;

    public PassthroughPlatformSettingsCache(
        IRepository<LocalizationSettings> localizationRepository,
        IRepository<PlatformBillingSettings> billingRepository,
        IRepository<SystemEmailSettings> systemEmailRepository,
        IRepository<PlatformUploadSettings> uploadRepository,
        IRepository<SystemAuthProviderSettings> systemAuthProviderRepository)
    {
        _localizationRepository = localizationRepository;
        _billingRepository = billingRepository;
        _systemEmailRepository = systemEmailRepository;
        _uploadRepository = uploadRepository;
        _systemAuthProviderRepository = systemAuthProviderRepository;
    }

    public Task<LocalizationSettings?> GetLocalizationAsync()
        => _localizationRepository.FirstOrDefaultNoTrackingAsync(_ => true);

    public Task<PlatformBillingSettings?> GetBillingAsync()
        => _billingRepository.FirstOrDefaultNoTrackingAsync(_ => true);

    public Task<SystemEmailSettings?> GetSystemEmailAsync()
        => _systemEmailRepository.FirstOrDefaultNoTrackingAsync(_ => true);

    public Task<PlatformUploadSettings?> GetUploadAsync()
        => _uploadRepository.FirstOrDefaultNoTrackingAsync(_ => true);

    public Task<SystemAuthProviderSettings?> GetSystemAuthProviderAsync()
        => _systemAuthProviderRepository.FirstOrDefaultNoTrackingAsync(_ => true);

    public void InvalidateLocalization() { }
    public void InvalidateBilling() { }
    public void InvalidateSystemEmail() { }
    public void InvalidateUpload() { }
    public void InvalidateSystemAuthProvider() { }
}

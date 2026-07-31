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
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<HabitusDbContext>));
            if (descriptor is not null)
                services.Remove(descriptor);

            services.AddDbContext<HabitusDbContext>(options =>
                options.UseNpgsql(TestConnectionString,
                    b => b.MigrationsAssembly("Habitus.Infrastructure")));
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

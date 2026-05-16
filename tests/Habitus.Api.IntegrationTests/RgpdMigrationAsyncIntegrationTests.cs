using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

public class RgpdMigrationAsyncIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _databaseName = $"rgpd-migration-tests-{Guid.NewGuid()}";

    public RgpdMigrationAsyncIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<HabitusDbContext>>();
                services.RemoveAll<HabitusDbContext>();
                services.AddDbContext<HabitusDbContext>(options =>
                    options.UseInMemoryDatabase(_databaseName));

                services.RemoveAll<IRgpdMigrationJobQueue>();
                services.AddSingleton<IRgpdMigrationJobQueue, BlockingRgpdMigrationJobQueue>();
            });
        });
    }

    private static string CreateToken(Guid userId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, "Manager"),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task SeedManagerAndConsentAsync(Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        await db.Database.EnsureCreatedAsync();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            db.Users.Add(new User
            {
                Id = userId,
                Name = "Integration Manager",
                Email = $"integration.manager.{userId}@example.com",
                Phone = "910000001",
                PasswordHash = "integration-test-hash",
                Role = UserRole.Manager,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
        }

        var hasConsent = await db.UserGdprConsents.AnyAsync(c =>
            c.UserId == userId && c.AcceptedTerms && c.AcceptedPrivacyPolicy);

        if (!hasConsent)
        {
            db.UserGdprConsents.Add(new UserGdprConsent
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ConsentedAt = DateTime.UtcNow,
                IpAddress = "127.0.0.1",
                AcceptedTerms = true,
                AcceptedPrivacyPolicy = true,
            });
        }

        db.RgpdMigrationRuns.RemoveRange(db.RgpdMigrationRuns);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task RunEndpoint_ShouldReturnAccepted_ForManager()
    {
        var userId = Guid.NewGuid();
        await SeedManagerAndConsentAsync(userId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(userId));

        var response = await client.PostAsync("/api/maintenance/rgpd-migration/run", content: null);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("status", out var status));
        Assert.Equal("Running", status.GetString());
    }

    [Fact]
    public async Task RunEndpoint_ShouldReturnConflict_WhenAnotherRunIsRunning()
    {
        var userId = Guid.NewGuid();
        await SeedManagerAndConsentAsync(userId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(userId));

        var first = await client.PostAsync("/api/maintenance/rgpd-migration/run", content: null);
        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);

        var second = await client.PostAsync("/api/maintenance/rgpd-migration/run", content: null);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    private sealed class BlockingRgpdMigrationJobQueue : IRgpdMigrationJobQueue
    {
        public ValueTask EnqueueAsync(Guid runId, CancellationToken cancellationToken = default)
            => ValueTask.CompletedTask;

        public async IAsyncEnumerable<Guid> DequeueAllAsync([EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            await Task.Delay(Timeout.Infinite, cancellationToken);
            yield break;
        }
    }
}

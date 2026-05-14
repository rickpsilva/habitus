using System.Net.Http.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

public class UsersGdprAuthorizationIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly WebApplicationFactory<Program> _factory;

    public UsersGdprAuthorizationIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
            builder.UseEnvironment("Development"));
    }

    private static string CreateToken(string role, Guid userId, Guid? condominiumId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role),
        };

        if (condominiumId.HasValue)
        {
            claims.Add(new Claim("CondominiumId", condominiumId.Value.ToString()));
        }

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

    private async Task<User> SeedUserAsync(Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        var user = new User
        {
            Id = userId,
            Name = "RGPD Integration User",
            Email = $"rgpd.integration.{userId}@example.com",
            Phone = "910000000",
            PasswordHash = "integration-test-hash",
            Role = UserRole.Resident,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task MeDataExport_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/users/me/data-export");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MeConsentStatus_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/users/me/gdpr-consent/status");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SaveConsent_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/users/me/gdpr-consent", new
        {
            acceptedTerms = true,
            acceptedPrivacyPolicy = true,
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ApproveErasure_WithResidentToken_Returns403()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", Guid.NewGuid(), Guid.NewGuid()));

        var response = await client.PostAsync($"/api/users/{Guid.NewGuid()}/gdpr-erasure/approve", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ApproveErasure_WithManagerToken_Returns403()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager", Guid.NewGuid()));

        var response = await client.PostAsync($"/api/users/{Guid.NewGuid()}/gdpr-erasure/approve", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CondominiumUsersPaged_WithManagerToken_Returns403()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager", Guid.NewGuid()));

        var response = await client.GetAsync($"/api/users/condominium/{Guid.NewGuid()}/paged");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CondominiumUsersPaged_WithAdminFromDifferentCondominium_Returns403()
    {
        using var client = _factory.CreateClient();
        var tokenCondoId = Guid.NewGuid();
        var requestedCondoId = Guid.NewGuid();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Admin", Guid.NewGuid(), tokenCondoId));

        var response = await client.GetAsync($"/api/users/condominium/{requestedCondoId}/paged");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SaveConsent_WithValidBody_Returns200AndHasConsentTrue()
    {
        var userId = Guid.NewGuid();
        await SeedUserAsync(userId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId));

        var response = await client.PostAsJsonAsync("/api/users/me/gdpr-consent", new
        {
            acceptedTerms = true,
            acceptedPrivacyPolicy = true,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("hasConsent", out var hasConsent));
        Assert.True(hasConsent.GetBoolean());
    }

    [Fact]
    public async Task SaveConsent_WithInvalidBody_Returns400()
    {
        var userId = Guid.NewGuid();
        await SeedUserAsync(userId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId));

        var response = await client.PostAsJsonAsync("/api/users/me/gdpr-consent", new
        {
            acceptedTerms = false,
            acceptedPrivacyPolicy = true,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ConsentStatus_AfterConsent_ReturnsHasConsentTrue()
    {
        var userId = Guid.NewGuid();
        await SeedUserAsync(userId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId));

        var saveResponse = await client.PostAsJsonAsync("/api/users/me/gdpr-consent", new
        {
            acceptedTerms = true,
            acceptedPrivacyPolicy = true,
        });
        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);

        var statusResponse = await client.GetAsync("/api/users/me/gdpr-consent/status");
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);

        var body = await statusResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("hasConsent", out var hasConsent));
        Assert.True(hasConsent.GetBoolean());
    }

    [Fact]
    public async Task DataExport_WithExistingAuthenticatedUser_Returns200JsonFile()
    {
        var userId = Guid.NewGuid();
        await SeedUserAsync(userId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId));

        var response = await client.GetAsync("/api/users/me/data-export");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains(userId.ToString(), content);
    }

    [Fact]
    public async Task RequestErasure_SecondRequest_Returns400()
    {
        var userId = Guid.NewGuid();
        await SeedUserAsync(userId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId));

        var first = await client.PostAsync("/api/users/me/gdpr-erasure", null);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await client.PostAsync("/api/users/me/gdpr-erasure", null);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
    }
}

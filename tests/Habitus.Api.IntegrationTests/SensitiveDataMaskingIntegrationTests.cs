using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
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

public class SensitiveDataMaskingIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _databaseName = $"sensitive-masking-tests-{Guid.NewGuid()}";

    public SensitiveDataMaskingIntegrationTests(WebApplicationFactory<Program> factory)
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
            });
        });
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

    private async Task SeedUserWithConsentAsync(Guid userId, string role, string email, string phone, Guid? condominiumId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        await db.Database.EnsureCreatedAsync();

        var parsedRole = Enum.Parse<UserRole>(role);

        if (!await db.Users.AnyAsync(u => u.Id == userId))
        {
            db.Users.Add(new User
            {
                Id = userId,
                Name = $"{role} User",
                Email = email,
                EmailHash = Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash(email),
                Phone = phone,
                PasswordHash = "integration-test-hash",
                Role = parsedRole,
                CondominiumId = condominiumId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
        }

        if (!await db.UserGdprConsents.AnyAsync(c => c.UserId == userId && c.AcceptedTerms && c.AcceptedPrivacyPolicy))
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

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task MeEndpoint_WithManagerRole_ShouldReturnUnmaskedSensitiveFields()
    {
        var userId = Guid.NewGuid();
        await SeedUserWithConsentAsync(userId, "Manager", "manager.one@example.com", "912345678");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager", userId));

        var response = await client.GetAsync("/api/users/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("manager.one@example.com", body.GetProperty("email").GetString());
        Assert.Equal("912345678", body.GetProperty("phone").GetString());
    }

    [Fact]
    public async Task MeEndpoint_WithResidentRole_ShouldReturnMaskedSensitiveFields()
    {
        var condominiumId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        await SeedUserWithConsentAsync(userId, "Resident", "resident.one@example.com", "912345678", condominiumId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId, condominiumId));

        var response = await client.GetAsync("/api/users/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("r***@example.com", body.GetProperty("email").GetString());
        Assert.Equal("*******78", body.GetProperty("phone").GetString());
    }
}

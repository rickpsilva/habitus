using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
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

public class CommunicationSettingsSecurityIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _databaseName = $"communication-settings-security-tests-{Guid.NewGuid()}";

    public CommunicationSettingsSecurityIntegrationTests(WebApplicationFactory<Program> factory)
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

    private async Task SeedCondominiumUserAndConsentAsync(Guid userId, Guid condominiumId, UserRole role)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        await db.Database.EnsureCreatedAsync();

        if (!await db.Condominiums.AnyAsync(c => c.Id == condominiumId))
        {
            db.Condominiums.Add(new Condominium
            {
                Id = condominiumId,
                Name = "Condo Communication",
                Address = "Rua Comunicação 1",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
        }

        if (!await db.Users.AnyAsync(u => u.Id == userId))
        {
            db.Users.Add(new User
            {
                Id = userId,
                Name = $"{role} User",
                Email = $"communication.{role}.{userId}@example.com",
                EmailHash = Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash($"communication.{role}.{userId}@example.com"),
                Phone = "910100100",
                PasswordHash = "integration-test-hash",
                Role = role,
                CondominiumId = role == UserRole.Manager ? null : condominiumId,
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
    public async Task UpdateCommunicationSettings_WithSameCondominiumAdmin_ShouldStoreEncryptedSensitiveKeys()
    {
        var condominiumId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        await SeedCondominiumUserAndConsentAsync(adminId, condominiumId, UserRole.Admin);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Admin", adminId, condominiumId));

        var response = await client.PutAsJsonAsync($"/api/condominiums/{condominiumId}/communication-settings", new
        {
            emailEnabled = true,
            emailSmtpHost = "smtp.example.com",
            emailSmtpPort = 587,
            emailUsername = "smtp-user",
            emailPassword = "smtp-secret-password",
            emailFromAddress = "no-reply@example.com",
            emailFromName = "Habitus",
            emailUseSsl = true,
            whatsAppEnabled = true,
            whatsAppPhoneNumber = "+351912000111",
            whatsAppApiKey = "whatsapp-secret-key",
            whatsAppApiProvider = "twilio",
            whatsAppGroupId = "group-1",
            smsEnabled = true,
            smsProvider = "twilio",
            smsApiKey = "sms-secret-key",
            smsFromNumber = "+351210000000",
            allowAnnouncementComments = true,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var saved = await db.CommunicationSettings.FirstOrDefaultAsync(c => c.CondominiumId == condominiumId);

        Assert.NotNull(saved);
        Assert.NotEqual("whatsapp-secret-key", saved!.WhatsAppApiKey);
        Assert.NotEqual("sms-secret-key", saved.SmsApiKey);
        Assert.NotEqual("smtp-secret-password", saved.EmailPassword);
        Assert.False(string.IsNullOrWhiteSpace(saved.WhatsAppApiKey));
        Assert.False(string.IsNullOrWhiteSpace(saved.SmsApiKey));
        Assert.False(string.IsNullOrWhiteSpace(saved.EmailPassword));
    }

    [Fact]
    public async Task GetCommunicationSettings_WithDifferentCondominiumAdmin_ShouldReturnForbidden()
    {
        var adminCondominiumId = Guid.NewGuid();
        var requestedCondominiumId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        await SeedCondominiumUserAndConsentAsync(adminId, adminCondominiumId, UserRole.Admin);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Admin", adminId, adminCondominiumId));

        var response = await client.GetAsync($"/api/condominiums/{requestedCondominiumId}/communication-settings");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}

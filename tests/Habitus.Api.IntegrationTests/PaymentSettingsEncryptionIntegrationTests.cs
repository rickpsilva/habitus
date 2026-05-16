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

public class PaymentSettingsEncryptionIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _databaseName = $"payment-settings-encryption-tests-{Guid.NewGuid()}";

    public PaymentSettingsEncryptionIntegrationTests(WebApplicationFactory<Program> factory)
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

    private async Task SeedCondominiumAndConsentAsync(Guid userId, Guid condominiumId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        var condominiumExists = await db.Condominiums.AnyAsync(c => c.Id == condominiumId);
        if (!condominiumExists)
        {
            db.Condominiums.Add(new Condominium
            {
                Id = condominiumId,
                Name = "Condo Integration",
                Address = "Rua Integra 1",
                CreatedAt = DateTime.UtcNow,
                IsActive = true,
            });
        }

        var userExists = await db.Users.AnyAsync(u => u.Id == userId);
        if (!userExists)
        {
            db.Users.Add(new User
            {
                Id = userId,
                Name = "Integration Admin",
                Email = $"integration.admin.{userId}@example.com",
                Phone = "910000000",
                PasswordHash = "integration-test-hash",
                Role = UserRole.Admin,
                CondominiumId = condominiumId,
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

        await db.SaveChangesAsync();
    }

    private async Task SeedCondominiumUserAndConsentAsync(Guid userId, Guid condominiumId, UserRole role)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        var condominiumExists = await db.Condominiums.AnyAsync(c => c.Id == condominiumId);
        if (!condominiumExists)
        {
            db.Condominiums.Add(new Condominium
            {
                Id = condominiumId,
                Name = "Condo Payment Methods",
                Address = "Rua Methods 10",
                CreatedAt = DateTime.UtcNow,
                IsActive = true,
            });
        }

        var userExists = await db.Users.AnyAsync(u => u.Id == userId);
        if (!userExists)
        {
            db.Users.Add(new User
            {
                Id = userId,
                Name = $"{role} User",
                Email = $"payment.methods.{userId}@example.com",
                Phone = "910000111",
                PasswordHash = "integration-test-hash",
                Role = role,
                CondominiumId = role == UserRole.Manager ? null : condominiumId,
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

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task PaymentSettings_PutThenGet_ShouldStoreEncryptedAndReturnDecryptedIban()
    {
        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        await SeedCondominiumAndConsentAsync(userId, condominiumId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Admin", userId, condominiumId));

        var updateResponse = await client.PutAsJsonAsync(
            $"/api/condominiums/{condominiumId}/payment-settings",
            new
            {
                bankTransferEnabled = true,
                bankTransferIban = "PT50000201231234567890154",
                bankTransferAccountHolder = "Condo Integration",
                mbReferenceEnabled = false,
                mbReferenceEntity = (string?)null,
                mbReferenceReference = (string?)null,
                mbWayEnabled = false,
                mbWayPhoneNumber = (string?)null,
                mbWayMerchantId = (string?)null,
                cardEnabled = true,
                cardProvider = "stripe",
                cardPublicKey = "pk_test_public",
                cardSecretKey = "sk_test_secret",
                cardMerchantId = "merchant-1",
            });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var settings = await db.PaymentSettings.FirstOrDefaultAsync(ps => ps.CondominiumId == condominiumId);

            Assert.NotNull(settings);
            Assert.Null(settings!.BankTransferIban);
            Assert.False(string.IsNullOrWhiteSpace(settings.BankTransferIbanEncrypted));
            Assert.NotEqual("PT50000201231234567890154", settings.BankTransferIbanEncrypted);

            Assert.Null(settings.CardSecretKey);
            Assert.False(string.IsNullOrWhiteSpace(settings.CardSecretKeyEncrypted));
            Assert.NotEqual("sk_test_secret", settings.CardSecretKeyEncrypted);
        }

        var getResponse = await client.GetAsync($"/api/condominiums/{condominiumId}/payment-settings");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("bankTransferIban", out var iban));
        Assert.Equal("PT50000201231234567890154", iban.GetString());
        Assert.False(body.TryGetProperty("cardSecretKey", out _));
    }

    [Fact]
    public async Task PaymentMethods_Get_WithSameCondominiumResident_ShouldReturnDecryptedIbanAndMbWay()
    {
        var condominiumId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        await SeedCondominiumUserAndConsentAsync(userId, condominiumId, UserRole.Resident);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryptionService = scope.ServiceProvider.GetRequiredService<Habitus.Application.Interfaces.IEncryptionService>();
            db.PaymentSettings.Add(new PaymentSettings
            {
                Id = Guid.NewGuid(),
                CondominiumId = condominiumId,
                BankTransferEnabled = true,
                BankTransferIban = null,
                BankTransferIbanEncrypted = encryptionService.Encrypt("PT50000201231234567890154"),
                BankTransferAccountHolder = "Condo Holder",
                MBWayEnabled = true,
                MBWayPhoneNumber = null,
                MBWayPhoneNumberEncrypted = encryptionService.Encrypt("912345678"),
                MBReferenceEnabled = true,
                MBReferenceEntity = "12345",
                MBReferenceReference = "123456789",
                CardEnabled = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });

            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId, condominiumId));

        var response = await client.GetAsync($"/api/condominiums/{condominiumId}/payment-methods");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("PT50000201231234567890154", body.GetProperty("bankTransferIban").GetString());
        Assert.Equal("912345678", body.GetProperty("mbWayPhoneNumber").GetString());
    }

    [Fact]
    public async Task PaymentMethods_Get_WithDifferentCondominiumResident_ShouldReturnForbidden()
    {
        var userCondoId = Guid.NewGuid();
        var requestedCondoId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        await SeedCondominiumUserAndConsentAsync(userId, userCondoId, UserRole.Resident);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId, userCondoId));

        var response = await client.GetAsync($"/api/condominiums/{requestedCondoId}/payment-methods");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}

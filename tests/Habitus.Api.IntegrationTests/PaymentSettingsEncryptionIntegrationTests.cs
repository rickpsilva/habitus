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
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

public class PaymentSettingsEncryptionIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly WebApplicationFactory<Program> _factory;

    public PaymentSettingsEncryptionIntegrationTests(WebApplicationFactory<Program> factory)
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
}

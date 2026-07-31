using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Habitus.Application.DTOs.Consents;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Integration tests for the global RGPD/GDPR mandatory-consent gate
/// (<c>RequireMandatoryConsentFilter</c>). Verifies that an authenticated user who has not
/// accepted every currently-required mandatory consent is blocked with HTTP 451 on a normal
/// (non-allow-listed) endpoint, can still reach <c>GET/POST /api/platform/me/consents</c>, and is
/// no longer blocked once all mandatory consents are accepted. Covers REQ-SEC-005, REQ-AUTH-005.
/// </summary>
public class ConsentGateIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly CustomWebApplicationFactory _factory;

    // Per-test-instance tracking so Dispose deletes exactly what this test seeded (no residue).
    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _consentDefinitionIds = new();

    public ConsentGateIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ── Token / client helpers ──────────────────────────────────────────────────

    private static string CreateToken(Guid userId, UserRole role, Guid? condominiumId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role.ToString()),
        };
        if (condominiumId.HasValue)
            claims.Add(new Claim("CondominiumId", condominiumId.Value.ToString()));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(Issuer, Audience, claims,
            expires: DateTime.UtcNow.AddHours(1), signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private HttpClient CreateAuthenticatedClient(Guid userId, UserRole role, Guid? condominiumId = null)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(userId, role, condominiumId));
        return client;
    }

    // ── Seeding helpers ─────────────────────────────────────────────────────────

    private Condominium NewCondominium()
    {
        var condominium = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = $"Condo-{Guid.NewGuid():N}",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        _condominiumIds.Add(condominium.Id);
        return condominium;
    }

    private Unit NewUnit(Guid condominiumId, string number)
    {
        var unit = new Unit { Id = Guid.NewGuid(), CondominiumId = condominiumId, Number = number, Type = UnitType.Apartment };
        _unitIds.Add(unit.Id);
        return unit;
    }

    private User NewUser(IEncryptionService encryption, Guid condominiumId, Guid unitId)
    {
        var email = $"consent-{Guid.NewGuid():N}@test.local";
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Consent Test User",
            Email = string.Empty,
            EmailEncrypted = encryption.Encrypt(EmailHashHelper.Normalize(email)),
            EmailHash = EmailHashHelper.GenerateEmailHash(email),
            Phone = string.Empty,
            Role = UserRole.Resident,
            IsActive = true,
            CondominiumId = condominiumId,
            UnitId = unitId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Str0ng-Passw0rd!"),
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        };
        _userIds.Add(user.Id);
        return user;
    }

    private ConsentDefinition NewMandatoryDefinition()
    {
        var definition = new ConsentDefinition
        {
            Id = Guid.NewGuid(),
            Key = $"b4-test-{Guid.NewGuid():N}",
            Version = "1.0",
            Title = "B4 Test Mandatory Consent",
            IsMandatory = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        _consentDefinitionIds.Add(definition.Id);
        return definition;
    }

    /// <summary>Seeds an active condominium, unit, resident and a tracked mandatory consent.</summary>
    private async Task<(Guid userId, Guid condominiumId)> SeedUserRequiringConsentAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

        var condo = NewCondominium();
        var unit = NewUnit(condo.Id, "A-1");
        var user = NewUser(encryption, condo.Id, unit.Id);

        db.Condominiums.Add(condo);
        db.Units.Add(unit);
        db.Users.Add(user);
        db.ConsentDefinitions.Add(NewMandatoryDefinition());
        await db.SaveChangesAsync();

        return (user.Id, condo.Id);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// REQ-SEC-005: an authenticated user missing a mandatory consent is blocked with HTTP 451
    /// and a machine-readable <c>consent_required</c> body on a normal (non-allow-listed) endpoint.
    /// </summary>
    [Fact]
    public async Task NormalEndpoint_WhenMandatoryConsentMissing_Returns451()
    {
        var (userId, condoId) = await SeedUserRequiringConsentAsync();
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var response = await client.GetAsync($"/api/condominiums/{condoId}/notifications");

        Assert.Equal((HttpStatusCode)451, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ConsentRequiredBody>();
        Assert.NotNull(body);
        Assert.Equal("consent_required", body!.Code);
        Assert.NotEmpty(body.Missing);
    }

    /// <summary>REQ-AUTH-005: the consent endpoints stay reachable so a blocked user can recover.</summary>
    [Fact]
    public async Task ConsentEndpoints_AreReachable_EvenWhenBlocked()
    {
        var (userId, condoId) = await SeedUserRequiringConsentAsync();
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var getResponse = await client.GetAsync("/api/platform/me/consents");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var status = await getResponse.Content.ReadFromJsonAsync<ConsentStatusDto>();
        Assert.NotNull(status);
        Assert.False(status!.AllMandatoryAccepted);
        Assert.Contains(status.Consents, c => c.IsMandatory);
    }

    /// <summary>
    /// REQ-SEC-005: after accepting every mandatory consent the same normal endpoint is no longer
    /// gated (the gate lets the request through — a non-451 response).
    /// </summary>
    [Fact]
    public async Task NormalEndpoint_AfterAcceptingAllMandatoryConsents_IsNoLongerBlocked()
    {
        var (userId, condoId) = await SeedUserRequiringConsentAsync();
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        // Discover and accept every currently-required mandatory consent.
        var status = await client.GetFromJsonAsync<ConsentStatusDto>("/api/platform/me/consents");
        Assert.NotNull(status);
        foreach (var mandatory in status!.Consents.Where(c => c.IsMandatory))
        {
            var accept = await client.PostAsJsonAsync("/api/platform/me/consents",
                new RecordConsentRequest { Key = mandatory.Key, Version = mandatory.Version, Accepted = true });
            Assert.Equal(HttpStatusCode.OK, accept.StatusCode);
        }

        var confirm = await client.GetFromJsonAsync<ConsentStatusDto>("/api/platform/me/consents");
        Assert.NotNull(confirm);
        Assert.True(confirm!.AllMandatoryAccepted);

        // The gate no longer blocks: the same normal endpoint returns 200 (not 451).
        var response = await client.GetAsync($"/api/condominiums/{condoId}/notifications");
        Assert.NotEqual((HttpStatusCode)451, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class ConsentRequiredBody
    {
        public string Code { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public List<MissingConsent> Missing { get; set; } = new();
    }

    private sealed class MissingConsent
    {
        public string Key { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Deletes every row this test instance seeded against the dedicated <c>habitus_test</c>
    /// database, in FK-safe order (UserConsents → ConsentDefinitions and users → units →
    /// condominiums). UserConsents are removed by tracked user id first so the tracked mandatory
    /// definitions can then be deleted. Each delete is isolated and best-effort.
    /// </summary>
    public void Dispose()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        DeleteTracked(() => db.UserConsents.Where(c => _userIds.Contains(c.UserId)).ExecuteDelete());
        DeleteTracked(() => db.ConsentDefinitions.Where(d => _consentDefinitionIds.Contains(d.Id)).ExecuteDelete());
        DeleteTracked(() => db.Users.Where(u => _userIds.Contains(u.Id)).ExecuteDelete());
        DeleteTracked(() => db.Units.Where(u => _unitIds.Contains(u.Id)).ExecuteDelete());
        DeleteTracked(() => db.Condominiums.Where(c => _condominiumIds.Contains(c.Id)).ExecuteDelete());

        GC.SuppressFinalize(this);
    }

    private static void DeleteTracked(Action delete)
    {
        try
        {
            delete();
        }
        catch
        {
            // Best-effort cleanup: never let a failed delete abort the rest or fail the test run.
        }
    }
}

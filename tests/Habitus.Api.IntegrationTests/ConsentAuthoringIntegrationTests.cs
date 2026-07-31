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
using System.IdentityModel.Tokens.Jwt;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Integration tests for the Manager consent-authoring endpoints (REQ-SEC-008) under
/// <c>/api/platform/consents</c>. Verifies that a Manager can list/edit/publish, that non-Manager
/// authenticated roles are rejected with HTTP 403, and that the routes stay reachable (not 451)
/// even when the caller is missing a mandatory consent (allow-list).
/// </summary>
public class ConsentAuthoringIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly CustomWebApplicationFactory _factory;

    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _consentDefinitionIds = new();

    public ConsentAuthoringIntegrationTests(CustomWebApplicationFactory factory)
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

    private Guid SeedUser(UserRole role)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

        var condo = new Condominium { Id = Guid.NewGuid(), Name = $"Condo-{Guid.NewGuid():N}", IsActive = true, CreatedAt = DateTime.UtcNow };
        var unit = new Unit { Id = Guid.NewGuid(), CondominiumId = condo.Id, Number = "A-1", Type = UnitType.Apartment };
        var email = $"author-{Guid.NewGuid():N}@test.local";
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Authoring Test User",
            EmailEncrypted = encryption.Encrypt(EmailHashHelper.Normalize(email)),
            EmailHash = EmailHashHelper.GenerateEmailHash(email),
            Role = role,
            IsActive = true,
            CondominiumId = condo.Id,
            UnitId = unit.Id,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Str0ng-Passw0rd!"),
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        };

        _condominiumIds.Add(condo.Id);
        _unitIds.Add(unit.Id);
        _userIds.Add(user.Id);

        db.Condominiums.Add(condo);
        db.Units.Add(unit);
        db.Users.Add(user);
        db.SaveChanges();
        return user.Id;
    }

    private ConsentDefinition SeedDefinition(string key, string version, bool mandatory = true)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var def = new ConsentDefinition
        {
            Id = Guid.NewGuid(),
            Key = key,
            Version = version,
            Title = "Original Title",
            Body = "Original body",
            IsMandatory = mandatory,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        _consentDefinitionIds.Add(def.Id);
        db.ConsentDefinitions.Add(def);
        db.SaveChanges();
        return def;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Manager_CanListEditAndPublishConsentDefinitions()
    {
        var managerId = SeedUser(UserRole.Manager);
        var key = $"a8-terms-{Guid.NewGuid():N}";
        var def = SeedDefinition(key, "1.0");
        using var client = CreateAuthenticatedClient(managerId, UserRole.Manager);

        // List (200) and includes the seeded definition with its body.
        var list = await client.GetAsync("/api/platform/consents");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var definitions = await list.Content.ReadFromJsonAsync<List<ConsentDefinitionDto>>();
        Assert.NotNull(definitions);
        Assert.Contains(definitions!, d => d.Id == def.Id && d.Body == "Original body");

        // In-place edit (200) keeps Key/Version, changes text, stamps audit.
        var put = await client.PutAsJsonAsync($"/api/platform/consents/{def.Id}",
            new UpdateConsentDefinitionRequest { Title = "Corrected", Url = "https://x.test", Body = "Fixed body" });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var edited = await put.Content.ReadFromJsonAsync<ConsentDefinitionDto>();
        Assert.NotNull(edited);
        Assert.Equal("Corrected", edited!.Title);
        Assert.Equal("1.0", edited.Version);
        Assert.Equal(managerId, edited.UpdatedByUserId);
        Assert.NotNull(edited.UpdatedAt);

        // Publish a new version (201) for the same key.
        var post = await client.PostAsJsonAsync("/api/platform/consents",
            new PublishConsentVersionRequest { Key = key, Version = "2.0", Title = "Terms v2", Body = "v2", IsMandatory = true });
        Assert.Equal(HttpStatusCode.Created, post.StatusCode);
        var published = await post.Content.ReadFromJsonAsync<ConsentDefinitionDto>();
        Assert.NotNull(published);
        Assert.Equal("2.0", published!.Version);
        Assert.True(published.IsActive);
        Assert.Equal(managerId, published.CreatedByUserId);
        _consentDefinitionIds.Add(published.Id);
    }

    [Fact]
    public async Task Publish_DuplicateKeyVersion_Returns409()
    {
        var managerId = SeedUser(UserRole.Manager);
        var key = $"a8-dup-{Guid.NewGuid():N}";
        SeedDefinition(key, "1.0");
        using var client = CreateAuthenticatedClient(managerId, UserRole.Manager);

        var post = await client.PostAsJsonAsync("/api/platform/consents",
            new PublishConsentVersionRequest { Key = key, Version = "1.0", Title = "dup", IsMandatory = true });

        Assert.Equal(HttpStatusCode.Conflict, post.StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Resident)]
    [InlineData(UserRole.Admin)]
    public async Task NonManager_IsForbidden_OnAllAuthoringActions(UserRole role)
    {
        var userId = SeedUser(role);
        var def = SeedDefinition($"a8-forbid-{Guid.NewGuid():N}", "1.0");
        using var client = CreateAuthenticatedClient(userId, role);

        var list = await client.GetAsync("/api/platform/consents");
        Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);

        var put = await client.PutAsJsonAsync($"/api/platform/consents/{def.Id}",
            new UpdateConsentDefinitionRequest { Title = "x" });
        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);

        var post = await client.PostAsJsonAsync("/api/platform/consents",
            new PublishConsentVersionRequest { Key = "k", Version = "1.0", Title = "t", IsMandatory = true });
        Assert.Equal(HttpStatusCode.Forbidden, post.StatusCode);
    }

    [Fact]
    public async Task AuthoringRoutes_AreReachable_EvenWhenManagerMissingMandatoryConsent()
    {
        var managerId = SeedUser(UserRole.Manager);
        // A mandatory consent the Manager has NOT accepted would 451-gate normal endpoints.
        SeedDefinition($"a8-gate-{Guid.NewGuid():N}", "1.0", mandatory: true);
        using var client = CreateAuthenticatedClient(managerId, UserRole.Manager);

        var list = await client.GetAsync("/api/platform/consents");

        Assert.NotEqual((HttpStatusCode)451, list.StatusCode);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────────

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
        try { delete(); } catch { /* best-effort cleanup */ }
    }
}

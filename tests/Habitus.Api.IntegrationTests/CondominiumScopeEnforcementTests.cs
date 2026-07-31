using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Verifies that tenant-aware endpoints enforce JWT authentication and role-based
/// authorization, returning 401 when unauthenticated and 403 when the caller
/// lacks a tenant role (Manager has no CondominiumId and is excluded from
/// [Authorize(Roles = "Admin,Resident")] endpoints). Also verifies BUG-01 tenant isolation
/// on the [Authorize]-only AnnouncementsController via the CanAccessCondominium check.
/// </summary>
public class CondominiumScopeEnforcementTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly CustomWebApplicationFactory _factory;

    // Per-test-instance tracking so Dispose deletes exactly what this test seeded (no residue).
    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();

    public CondominiumScopeEnforcementTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ── Token helper ──────────────────────────────────────────────────────────

    private static string CreateToken(string role, Guid? condominiumId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new(ClaimTypes.Role, role),
        };

        if (condominiumId.HasValue)
            claims.Add(new Claim("CondominiumId", condominiumId.Value.ToString()));

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

    // ── Test data ─────────────────────────────────────────────────────────────

    // Only endpoints whose controllers are [Authorize(Roles = "Admin,Resident")] belong here:
    // a Manager token has no matching role, so authorization (which runs BEFORE MVC action
    // filters) rejects with 403. AnnouncementsController is [Authorize]-only, so a Manager passes
    // authorization and is instead blocked by the mandatory-consent filter (451); it is covered by
    // the dedicated tenant-isolation test below rather than this role-exclusion theory.
    public static TheoryData<string> TenantListEndpoints => new()
    {
        "/api/condominiums/00000000-0000-0000-0000-000000000001/assemblies/paged",
        "/api/condominiums/00000000-0000-0000-0000-000000000001/reservations/paged",
        "/api/condominiums/00000000-0000-0000-0000-000000000001/maintenance/paged",
        "/api/condominiums/00000000-0000-0000-0000-000000000001/financial/paged",
    };

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Theory]
    [MemberData(nameof(TenantListEndpoints))]
    public async Task TenantEndpoint_WithoutToken_Returns401(string endpoint)
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync(endpoint);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(TenantListEndpoints))]
    public async Task TenantEndpoint_WithManagerToken_Returns403(string endpoint)
    {
        // Manager role has no CondominiumId and is not in [Authorize(Roles = "Admin,Resident")]
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager"));

        var response = await client.GetAsync(endpoint);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AssembliesEndpoint_WithExpiredToken_Returns401()
    {
        using var client = _factory.CreateClient();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new(ClaimTypes.Role, "Admin"),
            new("CondominiumId", Guid.NewGuid().ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expired = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(-1), // already expired
            signingCredentials: creds);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(expired));

        var response = await client.GetAsync("/api/condominiums/00000000-0000-0000-0000-000000000001/assemblies/paged");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// BUG-01: AnnouncementsController is [Authorize]-only (not role-restricted), so a Manager
    /// token passes authorization and the mandatory-consent gate would return 451 for a throwaway
    /// user. To actually exercise the controller's CanAccessCondominium check we seed a real user,
    /// clear the consent gate for them, and mint a token scoped to condo B. Hitting an announcements
    /// endpoint under condo A (a DIFFERENT condominiumId than the token's claim) must return 403 —
    /// the tenant-isolation mismatch — not 451 and not a data leak.
    /// </summary>
    [Fact]
    public async Task AnnouncementsEndpoint_WithTokenScopedToDifferentCondominium_Returns403()
    {
        Guid userId, condoAId, condoBId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condoA = NewCondominium();
            var condoB = NewCondominium();
            var unitB = NewUnit(condoB.Id, "B-1");
            var user = NewUser(encryption, condoB.Id, unitB.Id);

            db.Condominiums.AddRange(condoA, condoB);
            db.Units.Add(unitB);
            db.Users.Add(user);
            await db.SaveChangesAsync();

            // Clear the RGPD mandatory-consent gate so the request reaches the controller.
            await SatisfyConsentsAsync(db, user.Id);
            await db.SaveChangesAsync();

            userId = user.Id;
            condoAId = condoA.Id;
            condoBId = condoB.Id;
        }

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(userId, "Resident", condoBId));

        // Token is scoped to condo B; ask for condo A's announcements → CanAccessCondominium fails.
        var response = await client.GetAsync($"/api/condominiums/{condoAId}/announcements/paged");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── Seeding helpers ─────────────────────────────────────────────────────────

    private static string CreateToken(Guid userId, string role, Guid condominiumId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role),
            new("CondominiumId", condominiumId.ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(Issuer, Audience, claims,
            expires: DateTime.UtcNow.AddHours(1), signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

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
        var email = $"scope-{Guid.NewGuid():N}@test.local";
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Scope Test User",
            EmailEncrypted = encryption.Encrypt(EmailHashHelper.Normalize(email)),
            EmailHash = EmailHashHelper.GenerateEmailHash(email),
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

    /// <summary>Records an acceptance for every active mandatory consent so the user clears the gate.</summary>
    private static async Task SatisfyConsentsAsync(HabitusDbContext db, Guid userId)
    {
        var mandatory = await db.ConsentDefinitions
            .Where(d => d.IsActive && d.IsMandatory)
            .ToListAsync();

        foreach (var def in mandatory)
        {
            db.UserConsents.Add(new UserConsent
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ConsentDefinitionId = def.Id,
                Accepted = true,
                DecidedAt = DateTime.UtcNow,
            });
        }
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────────

    public void Dispose()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        DeleteTracked(() => db.UserConsents.Where(c => _userIds.Contains(c.UserId)).ExecuteDelete());
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

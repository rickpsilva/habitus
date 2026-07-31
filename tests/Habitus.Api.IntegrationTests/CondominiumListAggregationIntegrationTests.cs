using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Condominium;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Integration tests for the Manager condominium LIST endpoints
/// (<c>GET /api/platform/condominiums</c> and <c>GET /api/platform/condominiums/paged</c>).
/// Their sole purpose is to execute the FU2 server-side <c>GROUP BY</c> aggregation
/// (<c>IRepository&lt;T&gt;.CountGroupedAsync</c>) against the real <c>habitus_test</c> Postgres
/// database — in particular the nullable Users grouping <c>GroupBy(u =&gt; u.CondominiumId!.Value)</c>
/// with the <c>u.CondominiumId != null</c> predicate — which the Moq-based unit tests never run
/// through EF Core / Npgsql. If that query cannot be translated the test fails at runtime.
/// Per-test tracked-Id teardown keeps the shared DB clean.
/// </summary>
public class CondominiumListAggregationIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";
    private const string SeedPassword = "Str0ng-Passw0rd!";

    private readonly CustomWebApplicationFactory _factory;

    // Per-test-instance tracking so Dispose deletes exactly (and only) what this test seeded
    // against the shared habitus_test database — no residue.
    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();

    public CondominiumListAggregationIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ── Token helper ──────────────────────────────────────────────────────────

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

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // A Manager token carries role Manager and NO CondominiumId claim.
    private HttpClient CreateManagerClient(Guid managerUserId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(managerUserId, UserRole.Manager));
        return client;
    }

    // ── Seeding helpers (track every Id they mint so Dispose can clean up) ───────

    private Condominium NewCondominium(bool isActive = true)
    {
        var condominium = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = $"Condo-{Guid.NewGuid():N}",
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
        };
        _condominiumIds.Add(condominium.Id);
        return condominium;
    }

    private Unit NewUnit(Guid condominiumId, string number)
    {
        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Number = number,
            Type = UnitType.Apartment,
        };
        _unitIds.Add(unit.Id);
        return unit;
    }

    private User NewUser(IEncryptionService encryption, UserRole role, Guid? condominiumId = null, Guid? unitId = null)
    {
        var email = $"user-{Guid.NewGuid():N}@test.local";
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User",
            EmailEncrypted = encryption.Encrypt(EmailHashHelper.Normalize(email)),
            EmailHash = EmailHashHelper.GenerateEmailHash(email),
            Role = role,
            IsActive = true,
            CondominiumId = condominiumId,
            UnitId = unitId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(SeedPassword),
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        };
        _userIds.Add(user.Id);
        return user;
    }

    /// <summary>
    /// Records an acceptance for every active mandatory consent definition so the seeded user
    /// clears the global RGPD consent gate (<c>RequireMandatoryConsentFilter</c>) and can reach
    /// the (non-allow-listed) condominium list endpoints instead of getting HTTP 451.
    /// </summary>
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

    // ── Test ────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Seeds two condominiums (A: 3 units / 4 users, B: 1 unit / 1 user) plus a Manager user
    /// with a null <c>CondominiumId</c>, then calls both Manager list endpoints. The value here
    /// is that both calls run the FU2 <c>CountGroupedAsync</c> GROUP BY against Postgres —
    /// including the nullable <c>GroupBy(u =&gt; u.CondominiumId!.Value)</c> guarded by
    /// <c>u.CondominiumId != null</c> — and assert the aggregated <c>TotalUnits</c>/<c>TotalUsers</c>
    /// are exact for the seeded condominiums. Other pre-existing condos in the shared DB are
    /// ignored by filtering to the seeded Ids.
    /// </summary>
    [Fact]
    public async Task ListEndpoints_AggregateUnitAndUserCounts_ViaServerSideGroupBy()
    {
        Guid condoAId, condoBId, managerUserId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condoA = NewCondominium();
            var condoB = NewCondominium();

            var unitsA = new[]
            {
                NewUnit(condoA.Id, "A-1"),
                NewUnit(condoA.Id, "A-2"),
                NewUnit(condoA.Id, "A-3"),
            };
            var unitB = NewUnit(condoB.Id, "B-1");

            var usersA = new[]
            {
                NewUser(encryption, UserRole.Resident, condoA.Id, unitsA[0].Id),
                NewUser(encryption, UserRole.Resident, condoA.Id, unitsA[1].Id),
                NewUser(encryption, UserRole.Resident, condoA.Id, unitsA[2].Id),
                NewUser(encryption, UserRole.Admin, condoA.Id),
            };
            var userB = NewUser(encryption, UserRole.Resident, condoB.Id, unitB.Id);

            // Manager with a null CondominiumId — proves the `u.CondominiumId != null` predicate
            // excludes nulls and the `.Value` group key never blows up on a NULL.
            var manager = NewUser(encryption, UserRole.Manager, condominiumId: null);

            db.Condominiums.AddRange(condoA, condoB);
            db.Units.AddRange(unitsA[0], unitsA[1], unitsA[2], unitB);
            db.Users.AddRange(usersA[0], usersA[1], usersA[2], usersA[3], userB, manager);
            await db.SaveChangesAsync();

            // The Manager must clear the RGPD mandatory-consent gate to reach the list endpoints.
            await SatisfyConsentsAsync(db, manager.Id);
            await db.SaveChangesAsync();

            condoAId = condoA.Id;
            condoBId = condoB.Id;
            managerUserId = manager.Id;
        }

        using var client = CreateManagerClient(managerUserId);

        // 1) GET /api/platform/condominiums — executes GetAllCondominiumsAsync' GROUP BY.
        var allResponse = await client.GetAsync("/api/platform/condominiums");
        Assert.Equal(HttpStatusCode.OK, allResponse.StatusCode);

        var all = await allResponse.Content.ReadFromJsonAsync<List<CondominiumResponse>>();
        Assert.NotNull(all);

        var allCondoA = all!.Single(c => c.Id == condoAId);
        var allCondoB = all.Single(c => c.Id == condoBId);
        Assert.Equal(3, allCondoA.TotalUnits);
        Assert.Equal(4, allCondoA.TotalUsers);
        Assert.Equal(1, allCondoB.TotalUnits);
        Assert.Equal(1, allCondoB.TotalUsers);

        // 2) GET /api/platform/condominiums/paged — exercises GetPagedCondominiumsAsync' GROUP BY.
        // A large pageSize guarantees the two seeded condos land on the first page.
        var pagedResponse = await client.GetAsync("/api/platform/condominiums/paged?page=1&pageSize=200");
        Assert.Equal(HttpStatusCode.OK, pagedResponse.StatusCode);

        var paged = await pagedResponse.Content.ReadFromJsonAsync<PaginatedResponse<CondominiumResponse>>();
        Assert.NotNull(paged);

        var pagedCondoA = paged!.Items.Single(c => c.Id == condoAId);
        var pagedCondoB = paged.Items.Single(c => c.Id == condoBId);
        Assert.Equal(3, pagedCondoA.TotalUnits);
        Assert.Equal(4, pagedCondoA.TotalUsers);
        Assert.Equal(1, pagedCondoB.TotalUnits);
        Assert.Equal(1, pagedCondoB.TotalUsers);
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Deletes every row this test instance seeded, in FK-safe order (users → units →
    /// condominiums), targeting only the tracked Id sets. Each step is isolated so a partial DB
    /// state never blocks the remaining deletes. Runs after each test (xUnit creates a fresh
    /// instance per test method).
    /// </summary>
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

    /// <summary>
    /// Runs a single tracked-delete step, swallowing any failure so the remaining FK-ordered
    /// deletes still execute even if the database is in a partial or unexpected state.
    /// </summary>
    private static void DeleteTracked(Action delete)
    {
        try
        {
            delete();
        }
        catch
        {
            // Best-effort teardown: ignore and continue with the remaining deletes.
        }
    }
}

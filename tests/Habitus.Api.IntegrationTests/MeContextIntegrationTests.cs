using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Habitus.Application.DTOs.Auth;
using Habitus.Application.DTOs.Memberships;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Integration tests for <c>MeController</c> (<c>/api/platform/me</c>): the membership
/// listing and active-context switching endpoints that back multi-condominium context
/// selection. Verifies authentication, multi-condominium isolation, token re-scoping,
/// forbidden/inactive-context handling and the login <c>RequiresContextSelection</c> flag.
/// Covers REQ-AUTH-006, REQ-UNITS-002, REQ-UNITS-003.
/// </summary>
public class MeContextIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";
    private const string SeedPassword = "Str0ng-Passw0rd!";

    private readonly CustomWebApplicationFactory _factory;

    // Per-test-instance tracking of every row this test seeds, so Dispose can delete exactly
    // (and only) what it created against the dedicated habitus_test database — no residue, no
    // global Name-based deletes. xUnit instantiates the test class once per test method, so
    // Dispose runs after each individual test.
    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _membershipIds = new();

    public MeContextIntegrationTests(CustomWebApplicationFactory factory)
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

    private HttpClient CreateAuthenticatedClient(Guid userId, UserRole role, Guid? condominiumId = null)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(userId, role, condominiumId));
        return client;
    }

    // ── Seeding helpers ─────────────────────────────────────────────────────────
    // Each helper records the Id it generates into the per-instance tracking sets, so every
    // entity produced here is guaranteed to be cleaned up by Dispose, regardless of which test
    // creates it. Kept as instance methods (not static) purely so they can track.

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
            Email = string.Empty,
            EmailEncrypted = encryption.Encrypt(EmailHashHelper.Normalize(email)),
            EmailHash = EmailHashHelper.GenerateEmailHash(email),
            Phone = string.Empty,
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

    private UnitMembership NewMembership(Guid userId, Guid unitId, Guid condominiumId, bool isPrimary)
    {
        var membership = new UnitMembership
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            UnitId = unitId,
            CondominiumId = condominiumId,
            IsPrimary = isPrimary,
            CreatedAt = DateTime.UtcNow,
        };
        _membershipIds.Add(membership.Id);
        return membership;
    }

    private string DecryptedEmail(User user)
    {
        using var scope = _factory.Services.CreateScope();
        var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();
        return encryption.Decrypt(user.EmailEncrypted!);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    /// <summary>REQ-AUTH-006: the membership endpoint rejects anonymous callers with 401.</summary>
    [Fact]
    public async Task GetMemberships_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/platform/me/memberships");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// REQ-UNITS-002: a user with several memberships (two units in one condo and one unit in
    /// another) sees exactly their own memberships and nothing belonging to another user/condo.
    /// </summary>
    [Fact]
    public async Task GetMemberships_ForMultiCondominiumUser_ReturnsOnlyOwnMemberships()
    {
        Guid targetUserId;
        Guid condoAId, condoBId;
        Guid unit1Id, unit2Id, unit3Id, foreignUnitId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condoA = NewCondominium();
            var condoB = NewCondominium();
            var unit1 = NewUnit(condoA.Id, "A-1");
            var unit2 = NewUnit(condoA.Id, "A-2");
            var unit3 = NewUnit(condoB.Id, "B-1");
            var foreignUnit = NewUnit(condoA.Id, "A-9");

            var targetUser = NewUser(encryption, UserRole.Resident, condoA.Id, unit1.Id);
            var otherUser = NewUser(encryption, UserRole.Resident, condoA.Id, foreignUnit.Id);

            db.Condominiums.AddRange(condoA, condoB);
            db.Units.AddRange(unit1, unit2, unit3, foreignUnit);
            db.Users.AddRange(targetUser, otherUser);
            db.UnitMemberships.AddRange(
                NewMembership(targetUser.Id, unit1.Id, condoA.Id, isPrimary: true),
                NewMembership(targetUser.Id, unit2.Id, condoA.Id, isPrimary: false),
                NewMembership(targetUser.Id, unit3.Id, condoB.Id, isPrimary: true),
                // Belongs to another user in the same condominium — must never surface for the target.
                NewMembership(otherUser.Id, foreignUnit.Id, condoA.Id, isPrimary: true));
            await db.SaveChangesAsync();

            targetUserId = targetUser.Id;
            condoAId = condoA.Id;
            condoBId = condoB.Id;
            unit1Id = unit1.Id;
            unit2Id = unit2.Id;
            unit3Id = unit3.Id;
            foreignUnitId = foreignUnit.Id;
        }

        using var client = CreateAuthenticatedClient(targetUserId, UserRole.Resident);
        var result = await client.GetFromJsonAsync<MembershipsDto>("/api/platform/me/memberships");

        Assert.NotNull(result);

        // Only the target's two condominiums are returned.
        var returnedCondoIds = result!.Condominiums.Select(c => c.CondominiumId).ToHashSet();
        Assert.Equal(new HashSet<Guid> { condoAId, condoBId }, returnedCondoIds);

        // Condominium A exposes exactly the target's two units (not the other user's foreign unit).
        var returnedCondoA = result.Condominiums.Single(c => c.CondominiumId == condoAId);
        var condoAUnitIds = returnedCondoA.Units.Select(u => u.UnitId).ToHashSet();
        Assert.Equal(new HashSet<Guid> { unit1Id, unit2Id }, condoAUnitIds);
        Assert.DoesNotContain(foreignUnitId, condoAUnitIds);

        // Condominium B exposes exactly the single cross-condominium membership.
        var returnedCondoB = result.Condominiums.Single(c => c.CondominiumId == condoBId);
        Assert.Equal(new HashSet<Guid> { unit3Id }, returnedCondoB.Units.Select(u => u.UnitId).ToHashSet());
    }

    /// <summary>
    /// REQ-UNITS-003: switching to a membership the caller holds returns 200 and a fresh token
    /// whose CondominiumId/UnitId claims match the chosen context.
    /// </summary>
    [Fact]
    public async Task SetActiveContext_ForHeldMembership_Returns200AndRescopedToken()
    {
        Guid userId, condoBId, unit3Id;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condoA = NewCondominium();
            var condoB = NewCondominium();
            var unit1 = NewUnit(condoA.Id, "A-1");
            var unit3 = NewUnit(condoB.Id, "B-1");
            var user = NewUser(encryption, UserRole.Resident, condoA.Id, unit1.Id);

            db.Condominiums.AddRange(condoA, condoB);
            db.Units.AddRange(unit1, unit3);
            db.Users.Add(user);
            db.UnitMemberships.AddRange(
                NewMembership(user.Id, unit1.Id, condoA.Id, isPrimary: true),
                NewMembership(user.Id, unit3.Id, condoB.Id, isPrimary: false));
            await db.SaveChangesAsync();

            userId = user.Id;
            condoBId = condoB.Id;
            unit3Id = unit3.Id;
        }

        using var client = CreateAuthenticatedClient(userId, UserRole.Resident);
        var request = new SetActiveContextRequest { CondominiumId = condoBId, UnitId = unit3Id };

        var response = await client.PostAsJsonAsync("/api/platform/me/active-context", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(payload);
        Assert.Equal(condoBId, payload!.CondominiumId);
        Assert.Equal(unit3Id, payload.UnitId);
        Assert.False(payload.RequiresContextSelection);

        // The re-issued token carries the newly chosen context.
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(payload.Token);
        Assert.Equal(condoBId.ToString(), jwt.Claims.Single(c => c.Type == "CondominiumId").Value);
        Assert.Equal(unit3Id.ToString(), jwt.Claims.Single(c => c.Type == "UnitId").Value);
    }

    /// <summary>REQ-UNITS-003: requesting a context the caller does not hold is forbidden (403).</summary>
    [Fact]
    public async Task SetActiveContext_ForMembershipNotHeld_Returns403()
    {
        Guid userId, foreignCondoId, foreignUnitId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var ownCondo = NewCondominium();
            var foreignCondo = NewCondominium();
            var ownUnit = NewUnit(ownCondo.Id, "A-1");
            var foreignUnit = NewUnit(foreignCondo.Id, "Z-1");
            var user = NewUser(encryption, UserRole.Resident, ownCondo.Id, ownUnit.Id);

            db.Condominiums.AddRange(ownCondo, foreignCondo);
            db.Units.AddRange(ownUnit, foreignUnit);
            db.Users.Add(user);
            // User only holds a membership in ownCondo, never in foreignCondo.
            db.UnitMemberships.Add(NewMembership(user.Id, ownUnit.Id, ownCondo.Id, isPrimary: true));
            await db.SaveChangesAsync();

            userId = user.Id;
            foreignCondoId = foreignCondo.Id;
            foreignUnitId = foreignUnit.Id;
        }

        using var client = CreateAuthenticatedClient(userId, UserRole.Resident);
        var request = new SetActiveContextRequest { CondominiumId = foreignCondoId, UnitId = foreignUnitId };

        var response = await client.PostAsJsonAsync("/api/platform/me/active-context", request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    /// <summary>REQ-UNITS-003: switching to a held-but-inactive condominium returns 423 Locked.</summary>
    [Fact]
    public async Task SetActiveContext_ForInactiveCondominiumHeld_Returns423()
    {
        Guid userId, inactiveCondoId, inactiveUnitId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var activeCondo = NewCondominium(isActive: true);
            var inactiveCondo = NewCondominium(isActive: false);
            var activeUnit = NewUnit(activeCondo.Id, "A-1");
            var inactiveUnit = NewUnit(inactiveCondo.Id, "B-1");
            var user = NewUser(encryption, UserRole.Resident, activeCondo.Id, activeUnit.Id);

            db.Condominiums.AddRange(activeCondo, inactiveCondo);
            db.Units.AddRange(activeUnit, inactiveUnit);
            db.Users.Add(user);
            db.UnitMemberships.AddRange(
                NewMembership(user.Id, activeUnit.Id, activeCondo.Id, isPrimary: true),
                // User genuinely holds this membership, but the condominium is inactive.
                NewMembership(user.Id, inactiveUnit.Id, inactiveCondo.Id, isPrimary: false));
            await db.SaveChangesAsync();

            userId = user.Id;
            inactiveCondoId = inactiveCondo.Id;
            inactiveUnitId = inactiveUnit.Id;
        }

        // Token carries no CondominiumId claim, so the request reaches the controller/service
        // (rather than being short-circuited by the condominium-access guard middleware).
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident);
        var request = new SetActiveContextRequest { CondominiumId = inactiveCondoId, UnitId = inactiveUnitId };

        var response = await client.PostAsJsonAsync("/api/platform/me/active-context", request);

        Assert.Equal((HttpStatusCode)423, response.StatusCode);
    }

    /// <summary>
    /// REQ-AUTH-006: login for a user with more than one membership flags
    /// <c>RequiresContextSelection = true</c>; a single-membership user flags it false.
    /// </summary>
    [Fact]
    public async Task Login_SetsRequiresContextSelection_BasedOnMembershipCount()
    {
        User multiUser, singleUser;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit1 = NewUnit(condo.Id, "A-1");
            var unit2 = NewUnit(condo.Id, "A-2");
            var unit3 = NewUnit(condo.Id, "A-3");

            multiUser = NewUser(encryption, UserRole.Resident, condo.Id, unit1.Id);
            singleUser = NewUser(encryption, UserRole.Resident, condo.Id, unit3.Id);

            db.Condominiums.Add(condo);
            db.Units.AddRange(unit1, unit2, unit3);
            db.Users.AddRange(multiUser, singleUser);
            db.UnitMemberships.AddRange(
                NewMembership(multiUser.Id, unit1.Id, condo.Id, isPrimary: true),
                NewMembership(multiUser.Id, unit2.Id, condo.Id, isPrimary: false),
                NewMembership(singleUser.Id, unit3.Id, condo.Id, isPrimary: true));
            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();

        var multiResponse = await client.PostAsJsonAsync("/api/platform/auth/login",
            new LoginRequest { Email = DecryptedEmail(multiUser), Password = SeedPassword });
        Assert.Equal(HttpStatusCode.OK, multiResponse.StatusCode);
        var multiPayload = await multiResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(multiPayload);
        Assert.True(multiPayload!.RequiresContextSelection);

        var singleResponse = await client.PostAsJsonAsync("/api/platform/auth/login",
            new LoginRequest { Email = DecryptedEmail(singleUser), Password = SeedPassword });
        Assert.Equal(HttpStatusCode.OK, singleResponse.StatusCode);
        var singlePayload = await singleResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(singlePayload);
        Assert.False(singlePayload!.RequiresContextSelection);
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Deletes every row this test instance seeded against the real Development database, in
    /// FK-safe order (memberships → users → units → condominiums). Each delete is isolated so a
    /// partial DB state never prevents the remaining deletes, and only the tracked Id sets are
    /// targeted — never a global <c>Name LIKE 'Condo-%'</c> sweep. Runs after each test because
    /// xUnit creates a fresh test-class instance per test method.
    /// </summary>
    public void Dispose()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        DeleteTracked(() => db.UnitMemberships.Where(m => _membershipIds.Contains(m.Id)).ExecuteDelete());
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
            // Best-effort cleanup: never let a failed delete abort the rest or fail the test run.
        }
    }
}

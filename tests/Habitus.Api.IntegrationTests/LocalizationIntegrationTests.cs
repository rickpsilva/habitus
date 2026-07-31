using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Habitus.Application.DTOs.Localization;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Integration tests for the redesigned i18n / multilanguage backend (REQ-I18N-001): the
/// platform-wide <c>localization-settings</c> endpoints and the caller's
/// <c>/api/platform/me/localization</c> and <c>/api/platform/me/language</c> endpoints.
/// Multilanguage is now a subscription-plan entitlement, so the caller's ability to pick a
/// language depends on their active condominium's plan having the <c>multilanguage</c> feature
/// enabled. Runs against the dedicated <c>habitus_test</c> database with per-test tracked-Id
/// teardown (no residue).
/// </summary>
public class LocalizationIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly CustomWebApplicationFactory _factory;

    // Per-test-instance tracking so Dispose deletes exactly what this test seeded (no residue).
    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _planIds = new();
    private readonly HashSet<Guid> _subscriptionIds = new();
    private readonly HashSet<Guid> _localizationIds = new();

    public LocalizationIntegrationTests(CustomWebApplicationFactory factory)
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

    private User NewUser(IEncryptionService encryption, UserRole role, Guid? condominiumId = null, Guid? unitId = null)
    {
        var email = $"i18n-{Guid.NewGuid():N}@test.local";
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "I18n Test User",
            Email = string.Empty,
            EmailEncrypted = encryption.Encrypt(EmailHashHelper.Normalize(email)),
            EmailHash = EmailHashHelper.GenerateEmailHash(email),
            Phone = string.Empty,
            Role = role,
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

    /// <summary>
    /// Seeds a plan (with the <c>multilanguage</c> feature enabled or not) plus an active
    /// subscription binding it to the condominium, so the entitlement resolver sees it.
    /// </summary>
    private void SeedPlanWithMultilanguage(HabitusDbContext db, Guid condominiumId, bool multilanguageEnabled)
    {
        var plan = new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Name = $"Plan-{Guid.NewGuid():N}",
            Tier = PlanTier.Gold,
            IsActive = true,
            Features = new List<PlanFeature>
            {
                new() { Id = Guid.NewGuid(), FeatureKey = "multilanguage", FeatureLabel = "Multilíngua (PT/EN)", IsEnabled = multilanguageEnabled },
            },
        };
        _planIds.Add(plan.Id);

        var subscription = new CondominiumSubscription
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            PlanId = plan.Id,
            Status = SubscriptionStatus.Active,
            BillingCycle = BillingCycle.Monthly,
            StartDate = DateTime.UtcNow.AddDays(-1),
            NextBillingDate = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow,
        };
        _subscriptionIds.Add(subscription.Id);

        db.SubscriptionPlans.Add(plan);
        db.CondominiumSubscriptions.Add(subscription);
    }

    /// <summary>
    /// Records an acceptance for every active mandatory consent definition so the seeded user
    /// clears the global RGPD consent gate and can reach the (non-allow-listed) i18n endpoints.
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

    // ── Platform localization settings tests ────────────────────────────────────

    /// <summary>REQ-I18N-001: reading the platform settings when none exist returns defaults.</summary>
    [Fact]
    public async Task PlatformGet_WhenNoSettings_ReturnsDefault()
    {
        Guid userId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit = NewUnit(condo.Id, "A-1");
            var user = NewUser(encryption, UserRole.Resident, condo.Id, unit.Id);
            db.Condominiums.Add(condo);
            db.Units.Add(unit);
            db.Users.Add(user);
            await SatisfyConsentsAsync(db, user.Id);
            await db.SaveChangesAsync();

            userId = user.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);
        var dto = await client.GetFromJsonAsync<PlatformLocalizationSettingsDto>(
            "/api/platform/localization-settings");

        Assert.NotNull(dto);
        Assert.Equal("pt", dto!.DefaultLanguage);
    }

    /// <summary>REQ-I18N-001: a Manager sets the platform default language; a later GET reflects it.</summary>
    [Fact]
    public async Task ManagerPut_SetsDefaultLanguage_GetReflects()
    {
        Guid managerId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var manager = NewUser(encryption, UserRole.Manager);
            db.Condominiums.Add(condo);
            db.Users.Add(manager);
            await SatisfyConsentsAsync(db, manager.Id);
            await db.SaveChangesAsync();

            managerId = manager.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(managerId, UserRole.Manager, condoId);

        var putResponse = await client.PutAsJsonAsync(
            "/api/platform/localization-settings",
            new UpdatePlatformLocalizationSettingsRequest { DefaultLanguage = "en" });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var updated = await putResponse.Content.ReadFromJsonAsync<PlatformLocalizationSettingsDto>();
        Assert.NotNull(updated);
        Assert.NotEqual(Guid.Empty, updated!.Id);
        Assert.Equal("en", updated.DefaultLanguage);
        _localizationIds.Add(updated.Id);

        var reread = await client.GetFromJsonAsync<PlatformLocalizationSettingsDto>(
            "/api/platform/localization-settings");
        Assert.NotNull(reread);
        Assert.Equal("en", reread!.DefaultLanguage);
    }

    /// <summary>REQ-I18N-001: an unsupported platform default language is rejected (400).</summary>
    [Fact]
    public async Task ManagerPut_WithUnsupportedLanguage_Returns400()
    {
        Guid managerId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var manager = NewUser(encryption, UserRole.Manager);
            db.Condominiums.Add(condo);
            db.Users.Add(manager);
            await SatisfyConsentsAsync(db, manager.Id);
            await db.SaveChangesAsync();

            managerId = manager.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(managerId, UserRole.Manager, condoId);
        var response = await client.PutAsJsonAsync(
            "/api/platform/localization-settings",
            new UpdatePlatformLocalizationSettingsRequest { DefaultLanguage = "fr" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<CodeBody>();
        Assert.Equal("invalid_language", body!.Code);
    }

    /// <summary>REQ-I18N-001: non-Manager roles cannot change the platform settings (403).</summary>
    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Resident)]
    public async Task NonManagerPut_Returns403(UserRole role)
    {
        Guid userId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var user = NewUser(encryption, role, condo.Id);
            db.Condominiums.Add(condo);
            db.Users.Add(user);
            await SatisfyConsentsAsync(db, user.Id);
            await db.SaveChangesAsync();

            userId = user.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(userId, role, condoId);
        var response = await client.PutAsJsonAsync(
            "/api/platform/localization-settings",
            new UpdatePlatformLocalizationSettingsRequest { DefaultLanguage = "en" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── /me/localization + /me/language tests ───────────────────────────────────

    /// <summary>REQ-I18N-001: /me/localization reports MultilanguageEnabled=true when the plan grants it.</summary>
    [Fact]
    public async Task MeLocalization_WhenPlanHasMultilanguage_ReportsEnabled()
    {
        Guid userId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit = NewUnit(condo.Id, "A-1");
            var user = NewUser(encryption, UserRole.Resident, condo.Id, unit.Id);
            db.Condominiums.Add(condo);
            db.Units.Add(unit);
            db.Users.Add(user);
            SeedPlanWithMultilanguage(db, condo.Id, multilanguageEnabled: true);
            await SatisfyConsentsAsync(db, user.Id);
            await db.SaveChangesAsync();

            userId = user.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);
        var dto = await client.GetFromJsonAsync<MeLocalizationDto>("/api/platform/me/localization");

        Assert.NotNull(dto);
        Assert.True(dto!.MultilanguageEnabled);
        Assert.Equal("pt", dto.DefaultLanguage);
        Assert.Equal(new[] { "pt", "en" }, dto.SupportedLanguages);
    }

    /// <summary>REQ-I18N-001: /me/localization reports MultilanguageEnabled=false when the plan lacks it.</summary>
    [Fact]
    public async Task MeLocalization_WhenPlanLacksMultilanguage_ReportsDisabled()
    {
        Guid userId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit = NewUnit(condo.Id, "A-1");
            var user = NewUser(encryption, UserRole.Resident, condo.Id, unit.Id);
            db.Condominiums.Add(condo);
            db.Units.Add(unit);
            db.Users.Add(user);
            SeedPlanWithMultilanguage(db, condo.Id, multilanguageEnabled: false);
            await SatisfyConsentsAsync(db, user.Id);
            await db.SaveChangesAsync();

            userId = user.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);
        var dto = await client.GetFromJsonAsync<MeLocalizationDto>("/api/platform/me/localization");

        Assert.NotNull(dto);
        Assert.False(dto!.MultilanguageEnabled);
    }

    /// <summary>REQ-I18N-001: /me/language persists the preference when the plan grants multilanguage.</summary>
    [Fact]
    public async Task MeLanguage_WhenEnabled_PersistsPreferredLanguage()
    {
        Guid userId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit = NewUnit(condo.Id, "A-1");
            var user = NewUser(encryption, UserRole.Resident, condo.Id, unit.Id);
            db.Condominiums.Add(condo);
            db.Units.Add(unit);
            db.Users.Add(user);
            SeedPlanWithMultilanguage(db, condo.Id, multilanguageEnabled: true);
            await SatisfyConsentsAsync(db, user.Id);
            await db.SaveChangesAsync();

            userId = user.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var response = await client.PutAsJsonAsync(
            "/api/platform/me/language", new SetLanguageRequest { Language = "en" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var dto = await response.Content.ReadFromJsonAsync<MeLocalizationDto>();
        Assert.NotNull(dto);
        Assert.True(dto!.MultilanguageEnabled);
        Assert.Equal("en", dto.PreferredLanguage);

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var persisted = await verifyDb.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        Assert.Equal("en", persisted.PreferredLanguage);
    }

    /// <summary>REQ-I18N-001: /me/language with an unsupported language is rejected (400 invalid_language).</summary>
    [Fact]
    public async Task MeLanguage_WithUnsupportedLanguage_Returns400()
    {
        Guid userId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit = NewUnit(condo.Id, "A-1");
            var user = NewUser(encryption, UserRole.Resident, condo.Id, unit.Id);
            db.Condominiums.Add(condo);
            db.Units.Add(unit);
            db.Users.Add(user);
            SeedPlanWithMultilanguage(db, condo.Id, multilanguageEnabled: true);
            await SatisfyConsentsAsync(db, user.Id);
            await db.SaveChangesAsync();

            userId = user.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);
        var response = await client.PutAsJsonAsync(
            "/api/platform/me/language", new SetLanguageRequest { Language = "fr" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<CodeBody>();
        Assert.Equal("invalid_language", body!.Code);
    }

    /// <summary>REQ-I18N-001: /me/language is rejected (400 multilanguage_disabled) when the plan lacks the feature.</summary>
    [Fact]
    public async Task MeLanguage_WhenDisabled_Returns400()
    {
        Guid userId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit = NewUnit(condo.Id, "A-1");
            var user = NewUser(encryption, UserRole.Resident, condo.Id, unit.Id);
            db.Condominiums.Add(condo);
            db.Units.Add(unit);
            db.Users.Add(user);
            SeedPlanWithMultilanguage(db, condo.Id, multilanguageEnabled: false);
            await SatisfyConsentsAsync(db, user.Id);
            await db.SaveChangesAsync();

            userId = user.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);
        var response = await client.PutAsJsonAsync(
            "/api/platform/me/language", new SetLanguageRequest { Language = "en" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<CodeBody>();
        Assert.Equal("multilanguage_disabled", body!.Code);
    }

    /// <summary>
    /// The public pre-auth endpoint returns the platform default language without any
    /// Authorization header. Seeds a platform row with <c>en</c> and asserts the anonymous
    /// response reflects it.
    /// </summary>
    [Fact]
    public async Task PublicDefault_WithoutAuth_ReturnsDefaultLanguage()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

            var settings = new LocalizationSettings
            {
                Id = Guid.NewGuid(),
                DefaultLanguage = "en",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            _localizationIds.Add(settings.Id);
            db.LocalizationSettings.Add(settings);
            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/platform/localization-settings/public");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PublicDefaultBody>();
        Assert.NotNull(body);
        Assert.Equal("en", body!.DefaultLanguage);
    }

    private sealed class CodeBody
    {
        public string Code { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    private sealed class PublicDefaultBody
    {
        public string DefaultLanguage { get; set; } = string.Empty;
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Deletes every row this test instance seeded against <c>habitus_test</c>, in FK-safe order
    /// (subscriptions and plan features first, then plans, localization settings, user consents,
    /// users, units, condominiums). Only tracked Ids are targeted; seeded consent definitions are
    /// never deleted. Best-effort.
    /// </summary>
    public void Dispose()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        DeleteTracked(() => db.CondominiumSubscriptions.Where(s => _subscriptionIds.Contains(s.Id)).ExecuteDelete());
        DeleteTracked(() => db.PlanFeatures.Where(f => _planIds.Contains(f.PlanId)).ExecuteDelete());
        DeleteTracked(() => db.SubscriptionPlans.Where(p => _planIds.Contains(p.Id)).ExecuteDelete());
        DeleteTracked(() => db.LocalizationSettings.Where(l => _localizationIds.Contains(l.Id)).ExecuteDelete());
        DeleteTracked(() => db.UserConsents.Where(c => _userIds.Contains(c.UserId)).ExecuteDelete());
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

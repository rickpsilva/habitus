using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Habitus.Application.DTOs.Auth;
using Habitus.Application.DTOs.PersonalData;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Integration tests for GDPR/RGPD Article 17 erasure (<c>POST /api/platform/me/personal-data/erasure</c>):
/// full erasure anonymizes the account and disables login, partial erasure keeps the account,
/// the confirmation-phrase and password gates are enforced (including the social-login-only path),
/// the endpoint is reachable while a mandatory consent is pending, and an anonymized account can no
/// longer log in. Covers REQ-SEC-004, REQ-USERS-003.
/// </summary>
public class PersonalDataErasureIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";
    private const string SeedPassword = "Str0ng-Passw0rd!";

    private readonly CustomWebApplicationFactory _factory;

    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _consentDefinitionIds = new();
    private readonly HashSet<Guid> _paymentIds = new();

    public PersonalDataErasureIntegrationTests(CustomWebApplicationFactory factory) => _factory = factory;

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

    private Condominium NewCondominium() =>
        Track(new Condominium { Id = Guid.NewGuid(), Name = $"Condo-{Guid.NewGuid():N}", IsActive = true, CreatedAt = DateTime.UtcNow });

    private Unit NewUnit(Guid condoId, string number) =>
        Track(new Unit { Id = Guid.NewGuid(), CondominiumId = condoId, Number = number, Type = UnitType.Apartment });

    /// <summary>Seeds a resident. When <paramref name="social"/> the account has no password (social-login only).</summary>
    private User NewUser(IEncryptionService encryption, Guid condoId, Guid unitId, string email, bool social = false) =>
        Track(new User
        {
            Id = Guid.NewGuid(),
            Name = "Erasure Subject",
            Email = string.Empty,
            EmailEncrypted = encryption.Encrypt(EmailHashHelper.Normalize(email)),
            EmailHash = EmailHashHelper.GenerateEmailHash(email),
            Phone = string.Empty,
            PhoneEncrypted = encryption.Encrypt("+351911222333"),
            Role = UserRole.Resident,
            IsActive = true,
            CondominiumId = condoId,
            UnitId = unitId,
            PasswordHash = social ? string.Empty : BCrypt.Net.BCrypt.HashPassword(SeedPassword),
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        });

    private ConsentDefinition NewMandatoryDefinition() =>
        Track(new ConsentDefinition
        {
            Id = Guid.NewGuid(),
            Key = $"erasure-test-{Guid.NewGuid():N}",
            Version = "1.0",
            Title = "Mandatory Consent",
            IsMandatory = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });

    private async Task<(Guid userId, Guid condoId, string email)> SeedSubjectAsync(bool social = false, bool withMandatoryConsent = false)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

        var email = $"erasure-{Guid.NewGuid():N}@test.local";
        var condo = NewCondominium();
        var unit = NewUnit(condo.Id, "A-1");
        var user = NewUser(encryption, condo.Id, unit.Id, email, social);

        db.Condominiums.Add(condo);
        db.Units.Add(unit);
        db.Users.Add(user);
        if (withMandatoryConsent)
            db.ConsentDefinitions.Add(NewMandatoryDefinition());
        await db.SaveChangesAsync();

        return (user.Id, condo.Id, email);
    }

    private async Task<User?> ReloadUserAsync(Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        return await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    /// <summary>REQ-SEC-004: full erasure anonymizes the account, disables login and returns the result.</summary>
    [Fact]
    public async Task FullErasure_DisablesLogin_AndAnonymizes()
    {
        var (userId, condoId, _) = await SeedSubjectAsync();
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var response = await client.PostAsJsonAsync("/api/platform/me/personal-data/erasure",
            new ErasureRequestDto { Type = ErasureType.Full, ConfirmationPhrase = "ELIMINAR", CurrentPassword = SeedPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ErasureResultDto>();
        Assert.NotNull(result);
        Assert.True(result!.LoginDisabled);

        var user = await ReloadUserAsync(userId);
        Assert.NotNull(user);
        Assert.False(user!.IsActive);
        Assert.True(user.IsAnonymized);
        Assert.Equal("Unknown User", user.Name);
        Assert.Null(user.EmailHash);
    }

    /// <summary>REQ-SEC-004: partial erasure removes phone only and keeps the account active.</summary>
    [Fact]
    public async Task PartialErasure_KeepsLogin_AndRemovesPhoneOnly()
    {
        var (userId, condoId, _) = await SeedSubjectAsync();
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var response = await client.PostAsJsonAsync("/api/platform/me/personal-data/erasure",
            new ErasureRequestDto { Type = ErasureType.Partial, ConfirmationPhrase = "ELIMINAR", CurrentPassword = SeedPassword, Fields = new List<string> { "phone" } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ErasureResultDto>();
        Assert.False(result!.LoginDisabled);

        var user = await ReloadUserAsync(userId);
        Assert.NotNull(user);
        Assert.True(user!.IsActive);
        Assert.False(user.IsAnonymized);
        Assert.Null(user.PhoneEncrypted);
        Assert.NotNull(user.EmailHash);
    }

    /// <summary>REQ-SEC-004: a wrong confirmation phrase is rejected with 400 and a stable code.</summary>
    [Fact]
    public async Task Erasure_WrongPhrase_Returns400()
    {
        var (userId, condoId, _) = await SeedSubjectAsync();
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var response = await client.PostAsJsonAsync("/api/platform/me/personal-data/erasure",
            new ErasureRequestDto { Type = ErasureType.Full, ConfirmationPhrase = "nope", CurrentPassword = SeedPassword });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorBody>();
        Assert.Equal("invalid_confirmation_phrase", body!.Code);

        var user = await ReloadUserAsync(userId);
        Assert.False(user!.IsAnonymized);
    }

    /// <summary>REQ-SEC-004: a password account must supply the correct password; a wrong one is rejected.</summary>
    [Fact]
    public async Task Erasure_PasswordAccount_WrongPassword_Returns400()
    {
        var (userId, condoId, _) = await SeedSubjectAsync();
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var response = await client.PostAsJsonAsync("/api/platform/me/personal-data/erasure",
            new ErasureRequestDto { Type = ErasureType.Full, ConfirmationPhrase = "ELIMINAR", CurrentPassword = "wrong" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorBody>();
        Assert.Equal("invalid_password", body!.Code);
    }

    /// <summary>REQ-SEC-004: a social-login-only account (no password) confirms with the phrase alone.</summary>
    [Fact]
    public async Task Erasure_SocialLoginAccount_NoPassword_Succeeds()
    {
        var (userId, condoId, _) = await SeedSubjectAsync(social: true);
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var response = await client.PostAsJsonAsync("/api/platform/me/personal-data/erasure",
            new ErasureRequestDto { Type = ErasureType.Full, ConfirmationPhrase = "ELIMINAR" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = await ReloadUserAsync(userId);
        Assert.True(user!.IsAnonymized);
    }

    /// <summary>REQ-USERS-003: the erasure endpoint is allow-listed past the mandatory-consent 451 gate.</summary>
    [Fact]
    public async Task Erasure_ReachableWhileMandatoryConsentPending()
    {
        var (userId, condoId, _) = await SeedSubjectAsync(withMandatoryConsent: true);
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var response = await client.PostAsJsonAsync("/api/platform/me/personal-data/erasure",
            new ErasureRequestDto { Type = ErasureType.Full, ConfirmationPhrase = "ELIMINAR", CurrentPassword = SeedPassword });

        Assert.NotEqual((HttpStatusCode)451, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>REQ-SEC-004: after full erasure the original credentials can no longer log in.</summary>
    [Fact]
    public async Task AnonymizedAccount_CannotLogIn()
    {
        var (userId, condoId, email) = await SeedSubjectAsync();
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var erase = await client.PostAsJsonAsync("/api/platform/me/personal-data/erasure",
            new ErasureRequestDto { Type = ErasureType.Full, ConfirmationPhrase = "ELIMINAR", CurrentPassword = SeedPassword });
        Assert.Equal(HttpStatusCode.OK, erase.StatusCode);

        using var anon = _factory.CreateClient();
        var login = await anon.PostAsJsonAsync("/api/platform/auth/login",
            new LoginRequest { Email = email, Password = SeedPassword });

        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    /// <summary>
    /// REQ-SEC-004 financial-retention integrity: a Payment belonging to the subject must survive
    /// full erasure (the User row is anonymized in place, never deleted, so the restricted
    /// <c>Payment.ResidentId → User</c> FK is not triggered) even though the account's
    /// <c>UnitId</c>/<c>CondominiumId</c> are nulled. The retained payment still points at the
    /// (now anonymized) user id and does not orphan or throw an FK error.
    /// </summary>
    [Fact]
    public async Task FullErasure_RetainsPayments_AndNullsUserScope()
    {
        var (userId, condoId, _) = await SeedSubjectAsync();
        var unitId = await SeedPaymentForSubjectAsync(userId, condoId);
        using var client = CreateAuthenticatedClient(userId, UserRole.Resident, condoId);

        var response = await client.PostAsJsonAsync("/api/platform/me/personal-data/erasure",
            new ErasureRequestDto { Type = ErasureType.Full, ConfirmationPhrase = "ELIMINAR", CurrentPassword = SeedPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var user = await ReloadUserAsync(userId);
        Assert.NotNull(user);
        Assert.True(user!.IsAnonymized);
        Assert.Null(user.UnitId);
        Assert.Null(user.CondominiumId);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var payment = await db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.ResidentId == userId && p.UnitId == unitId);
        Assert.NotNull(payment);
        Assert.Equal(userId, payment!.ResidentId);
    }

    /// <summary>Seeds a retained financial record (Payment) owned by the subject and returns its unit id.</summary>
    private async Task<Guid> SeedPaymentForSubjectAsync(Guid userId, Guid condoId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        var unitId = user.UnitId!.Value;

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            ResidentId = userId,
            UnitId = unitId,
            CondominiumId = condoId,
            Type = PaymentType.MonthlyFee,
            Method = PaymentMethod.BankTransfer,
            Amount = 42.50m,
            Description = "Retained quota payment",
            Status = PaymentStatus.Approved,
            CreatedDate = DateTime.UtcNow,
        };
        _paymentIds.Add(payment.Id);
        db.Payments.Add(payment);
        await db.SaveChangesAsync();
        return unitId;
    }

    private sealed class ErrorBody
    {
        public string Code { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    // ── Tracking / cleanup ──────────────────────────────────────────────────

    private Condominium Track(Condominium c) { _condominiumIds.Add(c.Id); return c; }
    private Unit Track(Unit u) { _unitIds.Add(u.Id); return u; }
    private User Track(User u) { _userIds.Add(u.Id); return u; }
    private ConsentDefinition Track(ConsentDefinition d) { _consentDefinitionIds.Add(d.Id); return d; }

    public void Dispose()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        DeleteTracked(() => db.PersonalDataRequests.Where(r => _userIds.Contains(r.UserId)).ExecuteDelete());
        DeleteTracked(() => db.Payments.Where(p => _paymentIds.Contains(p.Id)).ExecuteDelete());
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

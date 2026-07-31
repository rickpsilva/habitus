using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
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
/// Integration tests for GDPR/RGPD Article 20 export (<c>GET /api/platform/me/export</c>):
/// returns a downloadable JSON attachment scoped to the caller, rejects anonymous callers,
/// excludes other tenants' records and stays reachable while a mandatory consent is pending
/// (allow-listed past the 451 gate). Covers REQ-SEC-003, REQ-USERS-003.
/// </summary>
public class PersonalDataExportIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly CustomWebApplicationFactory _factory;

    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _paymentIds = new();
    private readonly HashSet<Guid> _consentDefinitionIds = new();

    public PersonalDataExportIntegrationTests(CustomWebApplicationFactory factory) => _factory = factory;

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

    private User NewUser(IEncryptionService encryption, Guid condoId, Guid unitId, string email) =>
        Track(new User
        {
            Id = Guid.NewGuid(),
            Name = "Export Subject",
            EmailEncrypted = encryption.Encrypt(EmailHashHelper.Normalize(email)),
            EmailHash = EmailHashHelper.GenerateEmailHash(email),
            PhoneEncrypted = encryption.Encrypt("+351911222333"),
            Role = UserRole.Resident,
            IsActive = true,
            CondominiumId = condoId,
            UnitId = unitId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Str0ng-Passw0rd!"),
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        });

    private Payment NewPayment(Guid residentId, Guid unitId, Guid condoId, decimal amount, string description) =>
        Track(new Payment
        {
            Id = Guid.NewGuid(),
            ResidentId = residentId,
            UnitId = unitId,
            CondominiumId = condoId,
            Type = PaymentType.MonthlyFee,
            Method = PaymentMethod.BankTransfer,
            Amount = amount,
            Description = description,
            Status = PaymentStatus.Approved,
            CreatedDate = DateTime.UtcNow,
        });

    private ConsentDefinition NewMandatoryDefinition() =>
        Track(new ConsentDefinition
        {
            Id = Guid.NewGuid(),
            Key = $"export-test-{Guid.NewGuid():N}",
            Version = "1.0",
            Title = "Mandatory Consent",
            IsMandatory = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });

    // ── Tests ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// REQ-SEC-003: the export is a JSON attachment containing the caller's decrypted profile and
    /// their own records only (another user's payment in the same condo is excluded).
    /// </summary>
    [Fact]
    public async Task Export_ReturnsJsonAttachment_WithSubjectScopedData()
    {
        Guid subjectId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit = NewUnit(condo.Id, "A-1");
            var subject = NewUser(encryption, condo.Id, unit.Id, $"subject-{Guid.NewGuid():N}@test.local");
            var other = NewUser(encryption, condo.Id, unit.Id, $"other-{Guid.NewGuid():N}@test.local");

            db.Condominiums.Add(condo);
            db.Units.Add(unit);
            db.Users.AddRange(subject, other);
            db.Payments.Add(NewPayment(subject.Id, unit.Id, condo.Id, 42.50m, "Subject quota"));
            db.Payments.Add(NewPayment(other.Id, unit.Id, condo.Id, 99.00m, "Other quota"));
            await db.SaveChangesAsync();

            subjectId = subject.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(subjectId, UserRole.Resident, condoId);
        var response = await client.GetAsync("/api/platform/me/export");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(response.Content.Headers.ContentDisposition);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition!.DispositionType);
        Assert.Contains("habitus-export-", response.Content.Headers.ContentDisposition.FileName);

        var export = await response.Content.ReadFromJsonAsync<PersonalDataExportDto>();
        Assert.NotNull(export);
        Assert.Equal(subjectId, export!.ExportMetadata.SubjectUserId);
        Assert.Contains("@test.local", export.Profile.Email);
        Assert.Equal("+351911222333", export.Profile.Phone);
        Assert.Single(export.Records.Payments);
        Assert.Equal(42.50m, export.Records.Payments[0].Amount);
    }

    /// <summary>REQ-SEC-003: the export endpoint rejects anonymous callers with 401.</summary>
    [Fact]
    public async Task Export_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/platform/me/export");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// REQ-USERS-003: the export is allow-listed past the mandatory-consent gate, so a user with a
    /// pending mandatory consent can still exercise their data-portability right (not 451).
    /// </summary>
    [Fact]
    public async Task Export_ReachableWhileMandatoryConsentPending()
    {
        Guid subjectId, condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit = NewUnit(condo.Id, "A-1");
            var subject = NewUser(encryption, condo.Id, unit.Id, $"pending-{Guid.NewGuid():N}@test.local");

            db.Condominiums.Add(condo);
            db.Units.Add(unit);
            db.Users.Add(subject);
            db.ConsentDefinitions.Add(NewMandatoryDefinition());
            await db.SaveChangesAsync();

            subjectId = subject.Id;
            condoId = condo.Id;
        }

        using var client = CreateAuthenticatedClient(subjectId, UserRole.Resident, condoId);
        var response = await client.GetAsync("/api/platform/me/export");

        Assert.NotEqual((HttpStatusCode)451, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ── Tracking / cleanup ──────────────────────────────────────────────────

    private Condominium Track(Condominium c) { _condominiumIds.Add(c.Id); return c; }
    private Unit Track(Unit u) { _unitIds.Add(u.Id); return u; }
    private User Track(User u) { _userIds.Add(u.Id); return u; }
    private Payment Track(Payment p) { _paymentIds.Add(p.Id); return p; }
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

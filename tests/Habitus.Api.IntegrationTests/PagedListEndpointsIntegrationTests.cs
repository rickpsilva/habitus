using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Habitus.Application.DTOs.Announcements;
using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Maintenance;
using Habitus.Application.DTOs.Payments;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Integration tests for the new paged/status-count endpoints added for the list surfaces:
/// <c>GET .../announcements/paged</c>, <c>GET .../maintenance/paged</c> (+ <c>status</c> filter and
/// <c>status-counts</c>), and <c>GET .../payments/my/paged</c> (+ <c>my/status-counts</c>).
/// Their value over the Moq unit tests is that every LINQ predicate — the visibility/status/search
/// filters, the collapsed Completed-or-Closed maintenance filter, and the resident-scoped payment
/// counts — is translated to SQL and executed against the real <c>habitus_test</c> Postgres
/// database. If any query cannot be translated the test fails at runtime. Per-test tracked-Id
/// teardown keeps the shared DB clean.
/// </summary>
public class PagedListEndpointsIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";
    private const string SeedPassword = "Str0ng-Passw0rd!";

    private readonly CustomWebApplicationFactory _factory;

    // Per-test-instance tracking so Dispose deletes exactly (and only) what this test seeded.
    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _announcementIds = new();
    private readonly HashSet<Guid> _maintenanceIds = new();
    private readonly HashSet<Guid> _paymentIds = new();

    public PagedListEndpointsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ── Token helper ──────────────────────────────────────────────────────────

    private static string CreateToken(Guid userId, UserRole role, Guid condominiumId, Guid? unitId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role.ToString()),
            new("CondominiumId", condominiumId.ToString()),
        };

        if (unitId.HasValue)
            claims.Add(new Claim("UnitId", unitId.Value.ToString()));

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

    private HttpClient CreateResidentClient(Guid userId, Guid condominiumId, Guid unitId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(userId, UserRole.Resident, condominiumId, unitId));
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

    private User NewUser(IEncryptionService encryption, UserRole role, Guid condominiumId, Guid? unitId)
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

    private Announcement NewAnnouncement(Guid condominiumId, Guid authorId, AnnouncementStatus status, string title)
    {
        var announcement = new Announcement
        {
            Id = Guid.NewGuid(),
            Title = title,
            Content = "Body content",
            Category = AnnouncementCategory.General,
            Status = status,
            AuthorId = authorId,
            CondominiumId = condominiumId,
            CreatedAt = DateTime.UtcNow,
            PublishedAt = status == AnnouncementStatus.Published ? DateTime.UtcNow : null,
        };
        _announcementIds.Add(announcement.Id);
        return announcement;
    }

    private MaintenanceRequest NewMaintenance(Guid condominiumId, Guid unitId, Guid createdBy, MaintenanceStatus status)
    {
        var request = new MaintenanceRequest
        {
            Id = Guid.NewGuid(),
            Title = $"Maintenance {status}",
            Description = "Something is broken",
            Status = status,
            Priority = MaintenancePriority.Medium,
            CondominiumId = condominiumId,
            UnitId = unitId,
            CreatedBy = createdBy,
            Location = "Hall",
            CreatedAt = DateTime.UtcNow,
        };
        _maintenanceIds.Add(request.Id);
        return request;
    }

    private Payment NewPayment(Guid condominiumId, Guid residentId, Guid unitId, PaymentStatus status, string description = "Quota")
    {
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            ResidentId = residentId,
            UnitId = unitId,
            CondominiumId = condominiumId,
            Type = PaymentType.MonthlyFee,
            Method = PaymentMethod.BankTransfer,
            Amount = 50m,
            Description = description,
            Status = status,
            CreatedDate = DateTime.UtcNow,
        };
        _paymentIds.Add(payment.Id);
        return payment;
    }

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

    // ── Test ──────────────────────────────────────────────────────────────────

    /// <summary>
    /// Seeds one condominium with two residents, announcements across statuses, maintenance across
    /// every status, and payments across statuses (for both residents), then drives all six new
    /// endpoints as the first resident. Each assertion proves a specific server-side query: the
    /// announcement visibility/status/search filter and paging; the maintenance Completed-or-Closed
    /// collapse and status-counts; and the resident-scoped payment paging, status filter and counts
    /// (including that the other resident's payments are never returned).
    /// </summary>
    [Fact]
    public async Task PagedAndCountEndpoints_ExecuteScopedQueries_AgainstPostgres()
    {
        Guid condoId, unitId, residentId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var unit = NewUnit(condo.Id, "A-1");
            var otherUnit = NewUnit(condo.Id, "A-2");

            var resident = NewUser(encryption, UserRole.Resident, condo.Id, unit.Id);
            var otherResident = NewUser(encryption, UserRole.Resident, condo.Id, otherUnit.Id);
            var admin = NewUser(encryption, UserRole.Admin, condo.Id, null);

            // Announcements: 3 published (share the search token "Elevator") + 1 draft (hidden).
            var announcements = new[]
            {
                NewAnnouncement(condo.Id, admin.Id, AnnouncementStatus.Published, "Elevator maintenance one"),
                NewAnnouncement(condo.Id, admin.Id, AnnouncementStatus.Published, "Elevator maintenance two"),
                NewAnnouncement(condo.Id, admin.Id, AnnouncementStatus.Published, "Elevator maintenance three"),
                NewAnnouncement(condo.Id, admin.Id, AnnouncementStatus.Draft, "Elevator draft hidden"),
            };

            // Maintenance: 2 Open, 1 InProgress, 1 Completed, 1 Closed.
            var maintenance = new[]
            {
                NewMaintenance(condo.Id, unit.Id, resident.Id, MaintenanceStatus.Open),
                NewMaintenance(condo.Id, unit.Id, resident.Id, MaintenanceStatus.Open),
                NewMaintenance(condo.Id, unit.Id, resident.Id, MaintenanceStatus.InProgress),
                NewMaintenance(condo.Id, unit.Id, resident.Id, MaintenanceStatus.Completed),
                NewMaintenance(condo.Id, unit.Id, resident.Id, MaintenanceStatus.Closed),
            };

            // Payments: resident (2 Pending, 1 Approved, 1 Rejected, 1 Cancelled) + other resident.
            var payments = new[]
            {
                NewPayment(condo.Id, resident.Id, unit.Id, PaymentStatus.Pending),
                NewPayment(condo.Id, resident.Id, unit.Id, PaymentStatus.Pending),
                NewPayment(condo.Id, resident.Id, unit.Id, PaymentStatus.Approved),
                NewPayment(condo.Id, resident.Id, unit.Id, PaymentStatus.Rejected),
                NewPayment(condo.Id, resident.Id, unit.Id, PaymentStatus.Cancelled),
                NewPayment(condo.Id, otherResident.Id, otherUnit.Id, PaymentStatus.Pending),
                NewPayment(condo.Id, otherResident.Id, otherUnit.Id, PaymentStatus.Approved),
            };

            db.Condominiums.Add(condo);
            db.Units.AddRange(unit, otherUnit);
            db.Users.AddRange(resident, otherResident, admin);
            db.Announcements.AddRange(announcements);
            db.MaintenanceRequests.AddRange(maintenance);
            db.Payments.AddRange(payments);
            await db.SaveChangesAsync();

            await SatisfyConsentsAsync(db, resident.Id);
            await db.SaveChangesAsync();

            condoId = condo.Id;
            unitId = unit.Id;
            residentId = resident.Id;
        }

        using var client = CreateResidentClient(residentId, condoId, unitId);

        // 1) Announcements paged: published + search "Elevator", page size 2 → page 1 of 2, 3 total.
        var annResponse = await client.GetAsync(
            $"/api/condominiums/{condoId}/announcements/paged?page=1&pageSize=2&status=Published&search=Elevator");
        Assert.Equal(HttpStatusCode.OK, annResponse.StatusCode);

        var annPaged = await annResponse.Content.ReadFromJsonAsync<PaginatedResponse<AnnouncementDto>>();
        Assert.NotNull(annPaged);
        Assert.Equal(3, annPaged!.TotalItems);          // only the 3 published (draft excluded)
        Assert.Equal(2, annPaged.TotalPages);
        Assert.Equal(2, annPaged.Items.Count());        // first page holds pageSize items
        Assert.All(annPaged.Items, a => Assert.Equal("Published", a.Status)); // visibility preserved

        // 2) Maintenance paged with status=Completed → Completed AND Closed rows (collapsed).
        var maintResponse = await client.GetAsync(
            $"/api/condominiums/{condoId}/maintenance/paged?page=1&pageSize=10&status=Completed");
        Assert.Equal(HttpStatusCode.OK, maintResponse.StatusCode);

        var maintPaged = await maintResponse.Content.ReadFromJsonAsync<PaginatedResponse<MaintenanceRequestDto>>();
        Assert.NotNull(maintPaged);
        Assert.Equal(2, maintPaged!.TotalItems);        // Completed + Closed
        Assert.All(maintPaged.Items, m => Assert.Equal("Completed", m.Status)); // both surface as Completed

        // 3) Maintenance status-counts → {open:2, inProgress:1, completed:2}.
        var maintCountsResponse = await client.GetAsync(
            $"/api/condominiums/{condoId}/maintenance/status-counts");
        Assert.Equal(HttpStatusCode.OK, maintCountsResponse.StatusCode);

        var maintCounts = await maintCountsResponse.Content.ReadFromJsonAsync<MaintenanceStatusCountsDto>();
        Assert.NotNull(maintCounts);
        Assert.Equal(2, maintCounts!.Open);
        Assert.Equal(1, maintCounts.InProgress);
        Assert.Equal(2, maintCounts.Completed);

        // 4) Payments my/paged with status=Pending → only this resident's 2 pending payments.
        var payResponse = await client.GetAsync(
            $"/api/condominiums/{condoId}/payments/my/paged?page=1&pageSize=10&status=Pending");
        Assert.Equal(HttpStatusCode.OK, payResponse.StatusCode);

        var payPaged = await payResponse.Content.ReadFromJsonAsync<PaginatedResponse<PaymentDto>>();
        Assert.NotNull(payPaged);
        Assert.Equal(2, payPaged!.TotalItems);
        Assert.All(payPaged.Items, p =>
        {
            Assert.Equal("Pending", p.Status);
            Assert.Equal(residentId, p.ResidentId); // never the other resident's payments
        });

        // 5) Payments my/status-counts → {all:5, pending:2, approved:1, rejected:1, cancelled:1}.
        var payCountsResponse = await client.GetAsync(
            $"/api/condominiums/{condoId}/payments/my/status-counts");
        Assert.Equal(HttpStatusCode.OK, payCountsResponse.StatusCode);

        var payCounts = await payCountsResponse.Content.ReadFromJsonAsync<PaymentStatusCountsDto>();
        Assert.NotNull(payCounts);
        Assert.Equal(5, payCounts!.All);        // other resident's 2 payments excluded
        Assert.Equal(2, payCounts.Pending);
        Assert.Equal(1, payCounts.Approved);
        Assert.Equal(1, payCounts.Rejected);
        Assert.Equal(1, payCounts.Cancelled);
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Deletes every row this test instance seeded, in FK-safe order, targeting only the tracked Id
    /// sets. Each step is isolated so a partial DB state never blocks the remaining deletes.
    /// </summary>
    public void Dispose()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        DeleteTracked(() => db.Payments.Where(p => _paymentIds.Contains(p.Id)).ExecuteDelete());
        DeleteTracked(() => db.MaintenanceRequests.Where(m => _maintenanceIds.Contains(m.Id)).ExecuteDelete());
        DeleteTracked(() => db.Announcements.Where(a => _announcementIds.Contains(a.Id)).ExecuteDelete());
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
            // Best-effort teardown: ignore and continue with the remaining deletes.
        }
    }
}

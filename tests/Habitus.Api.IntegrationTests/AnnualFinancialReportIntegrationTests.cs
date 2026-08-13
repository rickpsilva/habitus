using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Habitus.Application.DTOs.Financial;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Integration tests for <c>GET .../financial/annual-report</c> (REQ-FIN-003). Verifies the
/// authorization contract (401 unauthenticated, 403 for Resident/Manager roles, 403 for an
/// admin scoped to a different condominium) and the aggregation itself (totals, monthly
/// breakdown, category breakdowns, reserve-fund exclusion, tenant isolation, empty year)
/// executed against the real <c>habitus_test</c> Postgres database.
/// </summary>
public class AnnualFinancialReportIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";
    private const string SeedPassword = "Str0ng-Passw0rd!";

    private readonly CustomWebApplicationFactory _factory;

    // Per-test-instance tracking so Dispose deletes exactly (and only) what this test seeded.
    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _recordIds = new();
    private readonly HashSet<Guid> _categoryIds = new();
    private readonly HashSet<Guid> _subscriptionIds = new();
    private readonly HashSet<Guid> _planIds = new();

    public AnnualFinancialReportIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ── Token helper ──────────────────────────────────────────────────────────

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

    private HttpClient CreateClient(string role, Guid condominiumId, Guid? userId = null)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(userId ?? Guid.NewGuid(), role, condominiumId));
        return client;
    }

    // ── Authorization tests (no seeding required) ─────────────────────────────

    [Fact]
    public async Task AnnualReport_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync(
            "/api/condominiums/00000000-0000-0000-0000-000000000001/financial/annual-report?year=2026");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AnnualReport_WithManagerRole_Returns403()
    {
        // Manager skips CondominiumAccessGuardMiddleware and is rejected by role authorization.
        using var client = CreateClient("Manager", Guid.NewGuid());

        var response = await client.GetAsync(
            $"/api/condominiums/{Guid.NewGuid()}/financial/annual-report?year=2026");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AnnualReport_WithResidentRole_Returns403()
    {
        // The access guard rejects tokens whose condominium does not exist with 423,
        // so seed a real active condominium to actually reach role authorization.
        Guid condoId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var condo = NewCondominium();
            db.Condominiums.Add(condo);
            await db.SaveChangesAsync();
            condoId = condo.Id;
        }

        using var client = CreateClient("Resident", condoId);

        var response = await client.GetAsync(
            $"/api/condominiums/{condoId}/financial/annual-report?year=2026");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── Tenant isolation + aggregation ────────────────────────────────────────

    [Fact]
    public async Task AnnualReport_WithAdminFromDifferentCondominium_Returns403()
    {
        Guid condoAId, condoBId, adminBId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condoA = NewCondominium();
            var condoB = NewCondominium();
            var adminB = NewUser(encryption, UserRole.Admin, condoB.Id);
            var planB = NewFinancialPlan();
            var subscriptionB = NewActiveSubscription(condoB.Id, planB.Id);

            db.Condominiums.AddRange(condoA, condoB);
            db.Users.Add(adminB);
            db.SubscriptionPlans.Add(planB);
            db.CondominiumSubscriptions.Add(subscriptionB);
            await db.SaveChangesAsync();

            await SatisfyConsentsAsync(db, adminB.Id);
            await db.SaveChangesAsync();

            condoAId = condoA.Id;
            condoBId = condoB.Id;
            adminBId = adminB.Id;
        }

        // Admin token scoped to condo B (with the financial feature enabled) asks for condo A.
        using var client = CreateClient("Admin", condoBId, adminBId);

        var response = await client.GetAsync(
            $"/api/condominiums/{condoAId}/financial/annual-report?year=2026");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AnnualReport_WithAdmin_ReturnsAggregatedReportForOwnCondominiumOnly()
    {
        const int year = 2026;
        Guid condoId, adminId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium();
            var otherCondo = NewCondominium();
            var admin = NewUser(encryption, UserRole.Admin, condo.Id);
            var plan = NewFinancialPlan();
            var subscription = NewActiveSubscription(condo.Id, plan.Id);

            var cleaning = NewExpenseCategory(condo.Id, "Limpeza");

            var records = new[]
            {
                NewRecord(condo.Id, FinancialType.Income, 1000m, new DateTime(year, 1, 10), IncomeCategory.MonthlyFees),
                NewRecord(condo.Id, FinancialType.Income, 500m, new DateTime(year, 3, 5), IncomeCategory.ExtraordinaryFees),
                NewRecord(condo.Id, FinancialType.Expense, 300m, new DateTime(year, 1, 20), null, cleaning.Id),
                NewRecord(condo.Id, FinancialType.Expense, 200m, new DateTime(year, 3, 15)),
                // Reserve fund movement: must be excluded from the report.
                NewRecord(condo.Id, FinancialType.Expense, 900m, new DateTime(year, 6, 1), null, null, ReserveFundCategory.Transfer),
                // Another condominium's record: must never leak into the report.
                NewRecord(otherCondo.Id, FinancialType.Income, 7777m, new DateTime(year, 1, 10), IncomeCategory.MonthlyFees),
            };

            db.Condominiums.AddRange(condo, otherCondo);
            db.Users.Add(admin);
            db.SubscriptionPlans.Add(plan);
            db.CondominiumSubscriptions.Add(subscription);
            db.ExpenseCategories.Add(cleaning);
            db.FinancialRecords.AddRange(records);
            await db.SaveChangesAsync();

            await SatisfyConsentsAsync(db, admin.Id);
            await db.SaveChangesAsync();

            condoId = condo.Id;
            adminId = admin.Id;
        }

        using var client = CreateClient("Admin", condoId, adminId);

        var response = await client.GetAsync(
            $"/api/condominiums/{condoId}/financial/annual-report?year={year}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var report = await response.Content.ReadFromJsonAsync<AnnualFinancialReportDto>();
        Assert.NotNull(report);
        Assert.Equal(year, report!.Year);
        Assert.Equal(1500m, report.TotalIncome);
        Assert.Equal(500m, report.TotalExpenses);
        Assert.Equal(1000m, report.Balance);

        Assert.Equal(12, report.MonthlyBreakdown.Count);
        var january = report.MonthlyBreakdown.Single(m => m.Month == 1);
        Assert.Equal(1000m, january.Income);
        Assert.Equal(300m, january.Expenses);
        Assert.Equal(700m, january.Balance);
        var march = report.MonthlyBreakdown.Single(m => m.Month == 3);
        Assert.Equal(500m, march.Income);
        Assert.Equal(200m, march.Expenses);

        Assert.Contains(report.IncomeByCategory, c => c.Category == "MonthlyFees" && c.Total == 1000m);
        Assert.Contains(report.IncomeByCategory, c => c.Category == "ExtraordinaryFees" && c.Total == 500m);
        Assert.Contains(report.ExpensesByTag, c => c.Category == "limpeza" && c.Total == 300m);
        Assert.Contains(report.ExpensesByTag, c => c.Category == "Sem categoria" && c.Total == 200m);
        // Reserve fund movement excluded → tag totals stay at 500.
        Assert.Equal(500m, report.ExpensesByTag.Sum(c => c.Total));

        // Empty year: zeroed report, no error.
        var emptyResponse = await client.GetAsync(
            $"/api/condominiums/{condoId}/financial/annual-report?year=2031");
        Assert.Equal(HttpStatusCode.OK, emptyResponse.StatusCode);

        var emptyReport = await emptyResponse.Content.ReadFromJsonAsync<AnnualFinancialReportDto>();
        Assert.NotNull(emptyReport);
        Assert.Equal(0m, emptyReport!.TotalIncome);
        Assert.Equal(0m, emptyReport.TotalExpenses);
        Assert.Equal(12, emptyReport.MonthlyBreakdown.Count);
        Assert.Empty(emptyReport.IncomeByCategory);
        Assert.Empty(emptyReport.ExpensesByTag);
    }

    // ── Seeding helpers ───────────────────────────────────────────────────────

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

    private User NewUser(IEncryptionService encryption, UserRole role, Guid condominiumId)
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
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(SeedPassword),
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        };
        _userIds.Add(user.Id);
        return user;
    }

    private FinancialRecord NewRecord(
        Guid condominiumId,
        FinancialType type,
        decimal amount,
        DateTime date,
        IncomeCategory? incomeCategory = null,
        Guid? expenseCategoryId = null,
        ReserveFundCategory? reserveFundCategory = null)
    {
        var record = new FinancialRecord
        {
            Id = Guid.NewGuid(),
            Type = type,
            Amount = amount,
            Description = $"Record {amount}",
            Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
            FiscalYear = date.Year,
            IncomeCategory = incomeCategory,
            ExpenseCategoryId = expenseCategoryId,
            ReserveFundCategory = reserveFundCategory,
            CondominiumId = condominiumId,
        };
        _recordIds.Add(record.Id);
        return record;
    }

    private ExpenseCategory NewExpenseCategory(Guid condominiumId, string name)
    {
        var category = new ExpenseCategory
        {
            Id = Guid.NewGuid(),
            Name = name,
            NormalizedName = name.ToUpperInvariant(),
            Hashtags = new List<string> { name.ToLowerInvariant() },
            CondominiumId = condominiumId,
        };
        _categoryIds.Add(category.Id);
        return category;
    }

    private SubscriptionPlan NewFinancialPlan()
    {
        var plan = new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Name = $"Plan-{Guid.NewGuid():N}",
            Tier = PlanTier.Silver,
            IsActive = true,
            Features = new List<PlanFeature>
            {
                new() { Id = Guid.NewGuid(), FeatureKey = "financial", FeatureLabel = "Financial", IsEnabled = true },
            },
        };
        _planIds.Add(plan.Id);
        return plan;
    }

    private CondominiumSubscription NewActiveSubscription(Guid condominiumId, Guid planId)
    {
        var subscription = new CondominiumSubscription
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            PlanId = planId,
            BillingCycle = BillingCycle.Monthly,
            Status = SubscriptionStatus.Active,
            StartDate = DateTime.UtcNow.AddDays(-1),
            NextBillingDate = DateTime.UtcNow.AddMonths(1),
            PriceAtPurchase = 0m,
            CreatedAt = DateTime.UtcNow,
        };
        _subscriptionIds.Add(subscription.Id);
        return subscription;
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

    // ── Cleanup ───────────────────────────────────────────────────────────────

    public void Dispose()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        DeleteTracked(() => db.FinancialRecords.Where(r => _recordIds.Contains(r.Id)).ExecuteDelete());
        DeleteTracked(() => db.ExpenseCategories.Where(c => _categoryIds.Contains(c.Id)).ExecuteDelete());
        DeleteTracked(() => db.UserConsents.Where(c => _userIds.Contains(c.UserId)).ExecuteDelete());
        DeleteTracked(() => db.Users.Where(u => _userIds.Contains(u.Id)).ExecuteDelete());
        DeleteTracked(() => db.CondominiumSubscriptions.Where(s => _subscriptionIds.Contains(s.Id)).ExecuteDelete());
        DeleteTracked(() => db.PlanFeatures.Where(f => _planIds.Contains(f.PlanId)).ExecuteDelete());
        DeleteTracked(() => db.SubscriptionPlans.Where(p => _planIds.Contains(p.Id)).ExecuteDelete());
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

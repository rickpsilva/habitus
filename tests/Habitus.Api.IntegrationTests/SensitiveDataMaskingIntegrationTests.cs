using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Habitus.Application.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

public class SensitiveDataMaskingIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _databaseName = $"sensitive-masking-tests-{Guid.NewGuid()}";

    public SensitiveDataMaskingIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<HabitusDbContext>>();
                services.RemoveAll<HabitusDbContext>();
                services.AddDbContext<HabitusDbContext>(options =>
                    options.UseInMemoryDatabase(_databaseName));
            });
        });
    }

    private static string CreateToken(string role, Guid userId, Guid? condominiumId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role),
        };

        if (condominiumId.HasValue)
        {
            claims.Add(new Claim("CondominiumId", condominiumId.Value.ToString()));
        }

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

    private async Task SeedUserWithConsentAsync(Guid userId, string role, string email, string phone, Guid? condominiumId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        await db.Database.EnsureCreatedAsync();

        var parsedRole = Enum.Parse<UserRole>(role);

        if (!await db.Users.AnyAsync(u => u.Id == userId))
        {
            db.Users.Add(new User
            {
                Id = userId,
                Name = $"{role} User",
                Email = email,
                EmailHash = Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash(email),
                Phone = phone,
                PasswordHash = "integration-test-hash",
                Role = parsedRole,
                CondominiumId = condominiumId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
        }

        if (!await db.UserGdprConsents.AnyAsync(c => c.UserId == userId && c.AcceptedTerms && c.AcceptedPrivacyPolicy))
        {
            db.UserGdprConsents.Add(new UserGdprConsent
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ConsentedAt = DateTime.UtcNow,
                IpAddress = "127.0.0.1",
                AcceptedTerms = true,
                AcceptedPrivacyPolicy = true,
            });
        }

        await db.SaveChangesAsync();
    }

    private async Task SeedUserAsync(Guid userId, string role, string email, string phone, Guid? condominiumId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        await db.Database.EnsureCreatedAsync();

        var parsedRole = Enum.Parse<UserRole>(role);

        if (!await db.Users.AnyAsync(u => u.Id == userId))
        {
            db.Users.Add(new User
            {
                Id = userId,
                Name = $"{role} Target User",
                Email = email,
                EmailHash = Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash(email),
                Phone = phone,
                PasswordHash = "integration-test-hash",
                Role = parsedRole,
                CondominiumId = condominiumId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync();
    }

    private async Task<Guid> SeedSupplierAsync(Guid condominiumId, string email, string phone, string address)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        await db.Database.EnsureCreatedAsync();

        if (!await db.Condominiums.AnyAsync(c => c.Id == condominiumId))
        {
            db.Condominiums.Add(new Condominium
            {
                Id = condominiumId,
                Name = "Condo Sensitive",
                Address = "Rua Principal 1",
                CreatedAt = DateTime.UtcNow,
                IsActive = true,
            });
        }

        var supplierId = Guid.NewGuid();
        db.Suppliers.Add(new Supplier
        {
            Id = supplierId,
            Name = "Supplier Sensitive",
            Contact = "Main Contact",
            Email = email,
            Phone = phone,
            Address = address,
            Specialty = "Plumbing",
            CondominiumId = condominiumId,
            IsActive = true,
        });

        await db.SaveChangesAsync();
        return supplierId;
    }

    private async Task SeedCondominiumDetailsAsync(Guid condominiumId, string condoTaxId, string adminEmail)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var encryptionService = scope.ServiceProvider.GetRequiredService<IEncryptionService>();
        await db.Database.EnsureCreatedAsync();

        if (!await db.Condominiums.AnyAsync(c => c.Id == condominiumId))
        {
            db.Condominiums.Add(new Condominium
            {
                Id = condominiumId,
                Name = "Condo Masking",
                Address = string.Empty,
                AddressEncrypted = encryptionService.Encrypt("Rua do Condomínio 10"),
                TaxId = null,
                TaxIdEncrypted = encryptionService.Encrypt(condoTaxId),
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
        }

        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Name = "Admin Condo",
            Email = adminEmail,
            EmailHash = Habitus.Application.Helpers.EmailHashHelper.GenerateEmailHash(adminEmail),
            Phone = "910000001",
            PasswordHash = "integration-test-hash",
            Role = UserRole.Admin,
            CondominiumId = condominiumId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync();
    }

    private async Task<Guid> SeedInvoiceForCondominiumAsync(Guid condominiumId, string customerTaxId, string customerAddress)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var encryptionService = scope.ServiceProvider.GetRequiredService<IEncryptionService>();
        await db.Database.EnsureCreatedAsync();

        var planId = Guid.NewGuid();
        var subscriptionId = Guid.NewGuid();

        if (!await db.Condominiums.AnyAsync(c => c.Id == condominiumId))
        {
            db.Condominiums.Add(new Condominium
            {
                Id = condominiumId,
                Name = "Condo Invoices",
                Address = string.Empty,
                AddressEncrypted = encryptionService.Encrypt("Rua Faturas 20"),
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
        }

        db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Id = planId,
            Name = "Starter",
            Tier = PlanTier.Silver,
            Description = "Starter Plan",
            PriceMonthly = 100m,
            AnnualDiscountPercent = 0m,
            QuinquennialDiscountPercent = 0m,
            PriceAnnual = 1200m,
            PriceQuinquennial = 6000m,
            IsActive = true,
        });

        db.CondominiumSubscriptions.Add(new CondominiumSubscription
        {
            Id = subscriptionId,
            CondominiumId = condominiumId,
            PlanId = planId,
            BillingCycle = BillingCycle.Monthly,
            Status = SubscriptionStatus.Active,
            StartDate = DateTime.UtcNow.Date.AddMonths(-1),
            NextBillingDate = DateTime.UtcNow.Date.AddMonths(1),
            PriceAtPurchase = 100m,
            CreatedAt = DateTime.UtcNow,
        });

        var invoiceId = Guid.NewGuid();
        db.Invoices.Add(new Invoice
        {
            Id = invoiceId,
            Number = 1,
            Series = "HABITUS",
            Year = DateTime.UtcNow.Year,
            Type = InvoiceType.FT,
            IssuedDate = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(30),
            CondominiumId = condominiumId,
            CustomerName = "Condo Invoices",
            CustomerTaxIdEncrypted = encryptionService.Encrypt(customerTaxId),
            CustomerAddressEncrypted = encryptionService.Encrypt(customerAddress),
            SubscriptionId = subscriptionId,
            PlanName = "Starter",
            PeriodStartDate = DateTime.UtcNow.Date,
            PeriodEndDate = DateTime.UtcNow.Date.AddMonths(1).AddDays(-1),
            SubtotalAmount = 100m,
            VatAmount = 23m,
            TotalAmount = 123m,
            VatRate = 0.23m,
            Status = InvoiceStatus.Emitted,
            CreatedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync();
        return invoiceId;
    }

    [Fact]
    public async Task MeEndpoint_WithManagerRole_ShouldReturnUnmaskedSensitiveFields()
    {
        var userId = Guid.NewGuid();
        await SeedUserWithConsentAsync(userId, "Manager", "manager.one@example.com", "912345678");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager", userId));

        var response = await client.GetAsync("/api/users/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("manager.one@example.com", body.GetProperty("email").GetString());
        Assert.Equal("912345678", body.GetProperty("phone").GetString());
    }

    [Fact]
    public async Task MeEndpoint_WithResidentRole_ShouldReturnMaskedSensitiveFields()
    {
        var condominiumId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        await SeedUserWithConsentAsync(userId, "Resident", "resident.one@example.com", "912345678", condominiumId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId, condominiumId));

        var response = await client.GetAsync("/api/users/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("r***@example.com", body.GetProperty("email").GetString());
        Assert.Equal("*******78", body.GetProperty("phone").GetString());
    }

    [Fact]
    public async Task SuppliersPaged_WithResidentRole_ShouldMaskSensitiveFieldsInItems()
    {
        var condominiumId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await SeedUserWithConsentAsync(userId, "Resident", "resident.two@example.com", "931111111", condominiumId);
        await SeedSupplierAsync(condominiumId, "supplier.private@example.com", "912345678", "Rua da Privacidade 12");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", userId, condominiumId));

        var response = await client.GetAsync("/api/suppliers/paged?page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var firstItem = body.GetProperty("items")[0];
        Assert.Equal("s***@example.com", firstItem.GetProperty("email").GetString());
        Assert.Equal("*******78", firstItem.GetProperty("phone").GetString());
        Assert.Equal("****", firstItem.GetProperty("address").GetString());
    }

    [Fact]
    public async Task SuppliersPaged_WithManagerRole_ShouldKeepSensitiveFieldsUnmasked()
    {
        var condominiumId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await SeedUserWithConsentAsync(userId, "Manager", "manager.two@example.com", "932222222");
        await SeedSupplierAsync(condominiumId, "supplier.full@example.com", "919888777", "Avenida Transparente 5");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager", userId));

        var response = await client.GetAsync("/api/suppliers/paged?page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var firstItem = body.GetProperty("items")[0];
        Assert.Equal("supplier.full@example.com", firstItem.GetProperty("email").GetString());
        Assert.Equal("919888777", firstItem.GetProperty("phone").GetString());
        Assert.Equal("Avenida Transparente 5", firstItem.GetProperty("address").GetString());
    }

    [Fact]
    public async Task SupplierById_WithResidentRole_ShouldMaskSensitiveFields()
    {
        var condominiumId = Guid.NewGuid();
        var residentId = Guid.NewGuid();

        await SeedUserWithConsentAsync(residentId, "Resident", "resident.supplier.byid@example.com", "991111111", condominiumId);
        var supplierId = await SeedSupplierAsync(condominiumId, "supplier.byid@example.com", "915555444", "Rua Sigilo 7");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", residentId, condominiumId));

        var response = await client.GetAsync($"/api/suppliers/{supplierId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("s***@example.com", body.GetProperty("email").GetString());
        Assert.Equal("*******44", body.GetProperty("phone").GetString());
        Assert.Equal("****", body.GetProperty("address").GetString());
    }

    [Fact]
    public async Task SupplierById_WithManagerRole_ShouldKeepSensitiveFieldsUnmasked()
    {
        var condominiumId = Guid.NewGuid();
        var managerId = Guid.NewGuid();

        await SeedUserWithConsentAsync(managerId, "Manager", "manager.supplier.byid@example.com", "992222222");
        var supplierId = await SeedSupplierAsync(condominiumId, "supplier.manager@example.com", "916666333", "Avenida Aberta 9");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager", managerId));

        var response = await client.GetAsync($"/api/suppliers/{supplierId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("supplier.manager@example.com", body.GetProperty("email").GetString());
        Assert.Equal("916666333", body.GetProperty("phone").GetString());
        Assert.Equal("Avenida Aberta 9", body.GetProperty("address").GetString());
    }

    [Fact]
    public async Task SupplierById_WithDifferentCondominiumResident_ShouldReturnForbidden()
    {
        var residentCondominiumId = Guid.NewGuid();
        var supplierCondominiumId = Guid.NewGuid();
        var residentId = Guid.NewGuid();

        await SeedUserWithConsentAsync(residentId, "Resident", "resident.supplier.scope@example.com", "993333333", residentCondominiumId);
        var supplierId = await SeedSupplierAsync(supplierCondominiumId, "supplier.scope@example.com", "917777222", "Rua Scope 11");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", residentId, residentCondominiumId));

        var response = await client.GetAsync($"/api/suppliers/{supplierId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CondominiumById_WithResidentRole_ShouldMaskTaxIdAndNestedAdminEmail()
    {
        var condominiumId = Guid.NewGuid();
        var residentId = Guid.NewGuid();

        await SeedCondominiumDetailsAsync(condominiumId, "509123456", "admin.condo@example.com");
        await SeedUserWithConsentAsync(residentId, "Resident", "resident.condo@example.com", "933333333", condominiumId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", residentId, condominiumId));

        var response = await client.GetAsync($"/api/condominiums/{condominiumId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("*****3456", body.GetProperty("taxId").GetString());
        var adminEmail = body.GetProperty("admins")[0].GetProperty("email").GetString();
        Assert.Equal("a***@example.com", adminEmail);
    }

    [Fact]
    public async Task CondominiumById_WithManagerRole_ShouldKeepTaxIdAndNestedAdminEmailUnmasked()
    {
        var condominiumId = Guid.NewGuid();
        var managerId = Guid.NewGuid();

        await SeedCondominiumDetailsAsync(condominiumId, "509123456", "admin.full@example.com");
        await SeedUserWithConsentAsync(managerId, "Manager", "manager.condo@example.com", "944444444");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager", managerId));

        var response = await client.GetAsync($"/api/condominiums/{condominiumId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("509123456", body.GetProperty("taxId").GetString());
        var adminEmail = body.GetProperty("admins")[0].GetProperty("email").GetString();
        Assert.Equal("admin.full@example.com", adminEmail);
    }

    [Fact]
    public async Task InvoicesByCondominium_WithResidentRole_ShouldMaskCustomerTaxIdAndAddress()
    {
        var condominiumId = Guid.NewGuid();
        var residentId = Guid.NewGuid();

        await SeedInvoiceForCondominiumAsync(condominiumId, "509123456", "Rua Faturas 20");
        await SeedUserWithConsentAsync(residentId, "Resident", "resident.invoice@example.com", "955555555", condominiumId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", residentId, condominiumId));

        var response = await client.GetAsync($"/api/invoices/{condominiumId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var firstInvoice = body[0];
        Assert.Equal("*****3456", firstInvoice.GetProperty("customerTaxId").GetString());
        Assert.Equal("****", firstInvoice.GetProperty("customerAddress").GetString());
    }

    [Fact]
    public async Task InvoicesByCondominium_WithManagerRole_ShouldKeepCustomerTaxIdAndAddressUnmasked()
    {
        var condominiumId = Guid.NewGuid();
        var managerId = Guid.NewGuid();

        await SeedInvoiceForCondominiumAsync(condominiumId, "509123456", "Rua Faturas 20");
        await SeedUserWithConsentAsync(managerId, "Manager", "manager.invoice@example.com", "966666666");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager", managerId));

        var response = await client.GetAsync($"/api/invoices/{condominiumId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var firstInvoice = body[0];
        Assert.Equal("509123456", firstInvoice.GetProperty("customerTaxId").GetString());
        Assert.Equal("Rua Faturas 20", firstInvoice.GetProperty("customerAddress").GetString());
    }

    [Fact]
    public async Task InvoiceDetail_WithResidentRole_ShouldMaskCustomerTaxIdAndAddress()
    {
        var condominiumId = Guid.NewGuid();
        var residentId = Guid.NewGuid();

        var invoiceId = await SeedInvoiceForCondominiumAsync(condominiumId, "509123456", "Rua Faturas 21");
        await SeedUserWithConsentAsync(residentId, "Resident", "resident.invoice.detail@example.com", "977777777", condominiumId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", residentId, condominiumId));

        var response = await client.GetAsync($"/api/invoices/detail/{invoiceId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("*****3456", body.GetProperty("customerTaxId").GetString());
        Assert.Equal("****", body.GetProperty("customerAddress").GetString());
    }

    [Fact]
    public async Task InvoiceDetail_WithManagerRole_ShouldKeepCustomerTaxIdAndAddressUnmasked()
    {
        var condominiumId = Guid.NewGuid();
        var managerId = Guid.NewGuid();

        var invoiceId = await SeedInvoiceForCondominiumAsync(condominiumId, "509123456", "Rua Faturas 21");
        await SeedUserWithConsentAsync(managerId, "Manager", "manager.invoice.detail@example.com", "988888888");

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Manager", managerId));

        var response = await client.GetAsync($"/api/invoices/detail/{invoiceId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("509123456", body.GetProperty("customerTaxId").GetString());
        Assert.Equal("Rua Faturas 21", body.GetProperty("customerAddress").GetString());
    }

    [Fact]
    public async Task UserById_WithResidentRole_ShouldMaskEmailAndPhone()
    {
        var condominiumId = Guid.NewGuid();
        var residentId = Guid.NewGuid();

        await SeedUserWithConsentAsync(residentId, "Resident", "resident.user.id@example.com", "911111111", condominiumId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", residentId, condominiumId));

        var response = await client.GetAsync($"/api/users/{residentId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("r***@example.com", body.GetProperty("email").GetString());
        Assert.Equal("*******11", body.GetProperty("phone").GetString());
    }

    [Fact]
    public async Task UserById_WithSameCondominiumAdminRole_ShouldKeepEmailAndPhoneUnmasked()
    {
        var condominiumId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var targetUserId = Guid.NewGuid();

        await SeedUserWithConsentAsync(adminId, "Admin", "admin.user.id@example.com", "922222222", condominiumId);
        await SeedUserAsync(targetUserId, "Resident", "target.user.id@example.com", "933333333", condominiumId);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Admin", adminId, condominiumId));

        var response = await client.GetAsync($"/api/users/{targetUserId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("target.user.id@example.com", body.GetProperty("email").GetString());
        Assert.Equal("933333333", body.GetProperty("phone").GetString());
    }
}

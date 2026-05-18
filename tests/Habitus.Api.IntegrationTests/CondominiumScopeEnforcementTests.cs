using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Verifies that tenant-aware endpoints enforce JWT authentication and role-based
/// authorization, returning 401 when unauthenticated and 403 when the caller
/// lacks a tenant role (Manager has no CondominiumId and is excluded from
/// [Authorize(Roles = "Admin,Resident")] endpoints).
/// </summary>
public class CondominiumScopeEnforcementTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";
    private static readonly Guid TestCondominiumId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TestAssemblyId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private readonly WebApplicationFactory<Program> _factory;

    public CondominiumScopeEnforcementTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
            builder.UseEnvironment("Development"));
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

    public static TheoryData<string> TenantListEndpoints => new()
    {
        $"/api/condominiums/{TestCondominiumId}/assemblies/paged",
        "/api/reservations/paged",
        "/api/maintenance/paged",
        "/api/financial/paged",
    };

    public static TheoryData<string> ScopeClaimRequiredEndpoints => new()
    {
        "/api/maintenance/paged",
        "/api/financial/paged",
    };

    public static TheoryData<string> FinancialRouteScopedEndpoints => new()
    {
        $"/api/financial/summary/{TestCondominiumId}",
        $"/api/financial/dashboard/{TestCondominiumId}",
        $"/api/financial/fiscal-years/{TestCondominiumId}",
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

        var response = await client.GetAsync($"/api/condominiums/{TestCondominiumId}/assemblies/paged");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AssembliesEndpoint_WithDifferentCondominiumAdminToken_Returns403()
    {
        using var client = _factory.CreateClient();
        var tokenCondominiumId = Guid.NewGuid();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Admin", tokenCondominiumId));

        var response = await client.GetAsync($"/api/condominiums/{TestCondominiumId}/assemblies/paged");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AssembliesEndpoint_WithDifferentCondominiumResidentToken_Returns403()
    {
        using var client = _factory.CreateClient();
        var tokenCondominiumId = Guid.NewGuid();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", tokenCondominiumId));

        var response = await client.GetAsync($"/api/condominiums/{TestCondominiumId}/assemblies/paged");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(ScopeClaimRequiredEndpoints))]
    public async Task TenantEndpoint_WithMissingCondominiumClaim_Returns403(string endpoint)
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Admin"));

        var response = await client.GetAsync(endpoint);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(FinancialRouteScopedEndpoints))]
    public async Task FinancialRouteScopedEndpoint_WithDifferentCondominiumResidentToken_Returns403(string endpoint)
    {
        using var client = _factory.CreateClient();
        var tokenCondominiumId = Guid.NewGuid();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", tokenCondominiumId));

        var response = await client.GetAsync(endpoint);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AssembliesById_WithDifferentCondominiumResidentToken_Returns403()
    {
        using var client = _factory.CreateClient();
        var tokenCondominiumId = Guid.NewGuid();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Resident", tokenCondominiumId));

        var response = await client.GetAsync($"/api/condominiums/{TestCondominiumId}/assemblies/{TestAssemblyId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AssembliesUpdate_WithDifferentCondominiumAdminToken_Returns403()
    {
        using var client = _factory.CreateClient();
        var tokenCondominiumId = Guid.NewGuid();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Admin", tokenCondominiumId));

        using var content = new StringContent("{}", Encoding.UTF8, "application/json");
        var response = await client.PutAsync($"/api/condominiums/{TestCondominiumId}/assemblies/{TestAssemblyId}", content);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AssembliesDelete_WithDifferentCondominiumAdminToken_Returns403()
    {
        using var client = _factory.CreateClient();
        var tokenCondominiumId = Guid.NewGuid();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken("Admin", tokenCondominiumId));

        var response = await client.DeleteAsync($"/api/condominiums/{TestCondominiumId}/assemblies/{TestAssemblyId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}

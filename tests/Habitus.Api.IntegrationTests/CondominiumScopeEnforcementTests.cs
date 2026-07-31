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
public class CondominiumScopeEnforcementTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly CustomWebApplicationFactory _factory;

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
}

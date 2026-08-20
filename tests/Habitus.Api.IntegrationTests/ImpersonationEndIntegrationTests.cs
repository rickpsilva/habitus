using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Habitus.Application.DTOs.Auth;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

/// <summary>
/// Integration tests for ending an impersonation session via
/// <c>POST /api/platform/auth/impersonate/end</c>. Verifies that a user acting under an
/// impersonation token (whose <c>NameIdentifier</c> is the impersonated user) can end the
/// session by relying on the <c>ImpersonatorUserId</c> claim, and that non-impersonating
/// requests are rejected with HTTP 400.
/// </summary>
public class ImpersonationEndIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";
    private const string SeedPassword = "Str0ng-Passw0rd!";

    private readonly CustomWebApplicationFactory _factory;

    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _unitIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _sessionIds = new();

    public ImpersonationEndIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static string CreateImpersonationToken(Guid impersonatedUserId, UserRole impersonatedRole, Guid impersonatorUserId, Guid condominiumId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, impersonatedUserId.ToString()),
            new(ClaimTypes.Role, impersonatedRole.ToString()),
            new("CondominiumId", condominiumId.ToString()),
            new("IsImpersonation", "true"),
            new("ImpersonatorUserId", impersonatorUserId.ToString()),
        };

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

    private HttpClient CreateImpersonatingClient(Guid impersonatedUserId, UserRole impersonatedRole, Guid impersonatorUserId, Guid condominiumId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateImpersonationToken(impersonatedUserId, impersonatedRole, impersonatorUserId, condominiumId));
        return client;
    }

    private static User NewUser(IEncryptionService encryption, UserRole role, string suffix, Guid? condominiumId = null, Guid? unitId = null)
    {
        var email = $"impersonation-{suffix}-{Guid.NewGuid():N}@test.local";
        return new User
        {
            Id = Guid.NewGuid(),
            Name = $"Test {suffix}",
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
    }

    [Fact]
    public async Task EndImpersonation_WithImpersonationToken_EndsSessionAndReturnsManagerToken()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        await using var dbContext = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

        var condominium = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = $"Condo-{Guid.NewGuid():N}",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        _condominiumIds.Add(condominium.Id);

        var manager = NewUser(encryption, UserRole.Manager, "manager", condominium.Id);
        var admin = NewUser(encryption, UserRole.Admin, "admin", condominium.Id);
        _userIds.Add(manager.Id);
        _userIds.Add(admin.Id);

        var session = new ImpersonationSession
        {
            Id = Guid.NewGuid(),
            ImpersonatorUserId = manager.Id,
            ImpersonatedUserId = admin.Id,
            CondominiumId = condominium.Id,
            StartedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            IsActive = true,
        };
        _sessionIds.Add(session.Id);

        dbContext.Condominiums.Add(condominium);
        dbContext.Users.AddRange(manager, admin);
        dbContext.ImpersonationSessions.Add(session);
        await dbContext.SaveChangesAsync();

        var client = CreateImpersonatingClient(admin.Id, UserRole.Admin, manager.Id, condominium.Id);

        // Act
        var response = await client.PostAsJsonAsync("/api/platform/auth/impersonate/end", new { });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(result);
        Assert.Equal(manager.Name, result.Name);
        Assert.Equal((int)UserRole.Manager, result.Role);

        var endedSession = await dbContext.ImpersonationSessions.FindAsync(session.Id);
        Assert.NotNull(endedSession);
        Assert.False(endedSession!.IsActive);
        Assert.Equal("ExplicitExit", endedSession.EndReason);
    }

    [Fact]
    public async Task EndImpersonation_WithoutImpersonationToken_ReturnsBadRequest()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        await using var dbContext = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

        var manager = NewUser(encryption, UserRole.Manager, "manager-no-impersonation");
        _userIds.Add(manager.Id);

        dbContext.Users.Add(manager);
        await dbContext.SaveChangesAsync();

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SecretKey));
        var token = tokenHandler.WriteToken(new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims:
            [
                new Claim(ClaimTypes.NameIdentifier, manager.Id.ToString()),
                new Claim(ClaimTypes.Role, UserRole.Manager.ToString()),
            ],
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await client.PostAsJsonAsync("/api/platform/auth/impersonate/end", new { });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    public void Dispose()
    {
        using var scope = _factory.Services.CreateScope();
        using var dbContext = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        var sessions = dbContext.ImpersonationSessions.Where(s => _sessionIds.Contains(s.Id)).ToList();
        dbContext.ImpersonationSessions.RemoveRange(sessions);

        var users = dbContext.Users.Where(u => _userIds.Contains(u.Id)).ToList();
        dbContext.Users.RemoveRange(users);

        var units = dbContext.Units.Where(u => _unitIds.Contains(u.Id)).ToList();
        dbContext.Units.RemoveRange(units);

        var condominiums = dbContext.Condominiums.Where(c => _condominiumIds.Contains(c.Id)).ToList();
        dbContext.Condominiums.RemoveRange(condominiums);

        dbContext.SaveChanges();
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Api.IntegrationTests;

public class MembershipAssociationRequestsIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IDisposable
{
    private const string SecretKey = "habitus-super-secret-key-for-development-only";
    private const string Issuer = "habitus";
    private const string Audience = "habitus-users";

    private readonly CustomWebApplicationFactory _factory;

    private readonly HashSet<Guid> _condominiumIds = new();
    private readonly HashSet<Guid> _userIds = new();
    private readonly HashSet<Guid> _associationRequestIds = new();

    public MembershipAssociationRequestsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateThenListPending_AsCondominiumAdmin_ReturnsCreatedPendingRequest()
    {
        Guid requesterId;
        Guid adminId;
        Guid condominiumId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condominium = NewCondominium("Condo-A");
            var requester = NewUser(encryption, UserRole.Resident, condominium.Id);
            var admin = NewUser(encryption, UserRole.Admin, condominium.Id);

            db.Condominiums.Add(condominium);
            db.Users.AddRange(requester, admin);
            db.UserCondominiums.Add(new UserCondominium
            {
                UserId = admin.Id,
                CondominiumId = condominium.Id,
                GrantedAt = DateTime.UtcNow,
                CanManage = true,
            });

            await db.SaveChangesAsync();

            requesterId = requester.Id;
            adminId = admin.Id;
            condominiumId = condominium.Id;
        }

        await SatisfyConsentsAsync(requesterId);
        await SatisfyConsentsAsync(adminId);

        using var requesterClient = CreateAuthenticatedClient(requesterId, UserRole.Resident, condominiumId);

        var createResponse = await requesterClient.PostAsJsonAsync("/api/platform/membership-association-requests", new
        {
            targetCondominiumId = condominiumId,
            requestedRole = (int)AssociationRequestedRole.Admin,
            source = (int)AssociationRequestSource.Manual,
            correlationId = "it-create-1"
        });

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

        using var adminClient = CreateAuthenticatedClient(adminId, UserRole.Admin, condominiumId);
        var pendingResponse = await adminClient.GetAsync("/api/platform/membership-association-requests/pending");

        Assert.Equal(HttpStatusCode.OK, pendingResponse.StatusCode);

        var pending = await pendingResponse.Content.ReadFromJsonAsync<List<AssociationRequestPayload>>();
        Assert.NotNull(pending);
        Assert.Contains(pending!, r =>
            r.RequesterUserId == requesterId &&
            r.TargetCondominiumId == condominiumId &&
            r.Status == (int)AssociationRequestStatus.Pending);
    }

    [Fact]
    public async Task CreateDuplicatePending_ReturnsConflictAlreadyPending()
    {
        Guid requesterId;
        Guid condominiumId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condominium = NewCondominium("Condo-Dup");
            var requester = NewUser(encryption, UserRole.Resident, condominium.Id);

            db.Condominiums.Add(condominium);
            db.Users.Add(requester);
            db.UserCondominiumAssociationRequests.Add(new UserCondominiumAssociationRequest
            {
                Id = Guid.NewGuid(),
                RequesterUserId = requester.Id,
                TargetCondominiumId = condominium.Id,
                RequestedRole = AssociationRequestedRole.Admin,
                Status = AssociationRequestStatus.Pending,
                Source = AssociationRequestSource.Manual,
                RequestedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });

            await db.SaveChangesAsync();

            requesterId = requester.Id;
            condominiumId = condominium.Id;
        }

        await SatisfyConsentsAsync(requesterId);

        using var client = CreateAuthenticatedClient(requesterId, UserRole.Resident, condominiumId);

        var response = await client.PostAsJsonAsync("/api/platform/membership-association-requests", new
        {
            targetCondominiumId = condominiumId,
            requestedRole = (int)AssociationRequestedRole.Admin,
            source = (int)AssociationRequestSource.Manual,
            correlationId = "it-dup-1"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("already_pending", payload.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task ApproveByAdminFromDifferentCondominium_ReturnsForbidden()
    {
        Guid reviewerId;
        Guid reviewerCondoId;
        Guid requestId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var targetCondo = NewCondominium("Target");
            var reviewerCondo = NewCondominium("Reviewer");
            var requester = NewUser(encryption, UserRole.Resident, targetCondo.Id);
            var reviewer = NewUser(encryption, UserRole.Admin, reviewerCondo.Id);

            var associationRequest = new UserCondominiumAssociationRequest
            {
                Id = Guid.NewGuid(),
                RequesterUserId = requester.Id,
                TargetCondominiumId = targetCondo.Id,
                RequestedRole = AssociationRequestedRole.Admin,
                Status = AssociationRequestStatus.Pending,
                Source = AssociationRequestSource.Manual,
                RequestedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            _associationRequestIds.Add(associationRequest.Id);

            db.Condominiums.AddRange(targetCondo, reviewerCondo);
            db.Users.AddRange(requester, reviewer);
            db.UserCondominiumAssociationRequests.Add(associationRequest);
            db.UserCondominiums.Add(new UserCondominium
            {
                UserId = reviewer.Id,
                CondominiumId = reviewerCondo.Id,
                GrantedAt = DateTime.UtcNow,
                CanManage = true,
            });

            await db.SaveChangesAsync();

            reviewerId = reviewer.Id;
            reviewerCondoId = reviewerCondo.Id;
            requestId = associationRequest.Id;
        }

        // Seed consent for the cross-condominium reviewer so the request passes the consent gate
        // and actually reaches the 403 tenant/authorization check the test asserts.
        await SatisfyConsentsAsync(reviewerId);

        using var client = CreateAuthenticatedClient(reviewerId, UserRole.Admin, reviewerCondoId);

        var response = await client.PostAsJsonAsync($"/api/platform/membership-association-requests/{requestId}/approve", new
        {
            reason = "ok"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AssociateExistingAdmin_ByEmail_IsIdempotent()
    {
        Guid managerId;
        Guid targetCondominiumId;
        string targetEmail;
        Guid targetUserId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();
            var encryption = scope.ServiceProvider.GetRequiredService<IEncryptionService>();

            var condo = NewCondominium("Condo-Assoc");
            var manager = NewUser(encryption, UserRole.Manager, null);
            var resident = NewUser(encryption, UserRole.Resident, null);

            db.Condominiums.Add(condo);
            db.Users.AddRange(manager, resident);
            await db.SaveChangesAsync();

            managerId = manager.Id;
            targetCondominiumId = condo.Id;
            targetEmail = encryption.Decrypt(resident.EmailEncrypted!);
            targetUserId = resident.Id;
        }

        await SatisfyConsentsAsync(managerId);

        using var client = CreateAuthenticatedClient(managerId, UserRole.Manager, null);

        var first = await client.PostAsJsonAsync("/api/platform/users/associate-existing-admin", new
        {
            email = targetEmail,
            condominiumId = targetCondominiumId,
        });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var firstPayload = JsonDocument.Parse(await first.Content.ReadAsStringAsync());
        Assert.False(firstPayload.RootElement.GetProperty("wasAlreadyAdmin").GetBoolean());

        var second = await client.PostAsJsonAsync("/api/platform/users/associate-existing-admin", new
        {
            email = targetEmail,
            condominiumId = targetCondominiumId,
        });
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        var secondPayload = JsonDocument.Parse(await second.Content.ReadAsStringAsync());
        Assert.True(secondPayload.RootElement.GetProperty("wasAlreadyAdmin").GetBoolean());

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<HabitusDbContext>();
        var links = verifyDb.UserCondominiums
            .Where(uc => uc.UserId == targetUserId && uc.CondominiumId == targetCondominiumId)
            .ToList();

        Assert.Single(links);
        Assert.True(links[0].CanManage);
    }

    private static string CreateToken(Guid userId, UserRole role, Guid? condominiumId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role.ToString()),
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

    private HttpClient CreateAuthenticatedClient(Guid userId, UserRole role, Guid? condominiumId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(userId, role, condominiumId));
        return client;
    }

    // Records acceptance of every active mandatory consent definition (latest version per key) for
    // the user, so their authenticated requests pass the global RequireMandatoryConsentFilter.
    private async Task SatisfyConsentsAsync(Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        var mandatory = await db.ConsentDefinitions
            .Where(d => d.IsActive && d.IsMandatory)
            .ToListAsync();

        var latestPerKey = mandatory
            .GroupBy(d => d.Key)
            .Select(g => g.OrderByDescending(d => d.CreatedAt).First());

        foreach (var def in latestPerKey)
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

        await db.SaveChangesAsync();
    }

    private Condominium NewCondominium(string name)
    {
        var condominium = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = $"{name}-{Guid.NewGuid():N}",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        _condominiumIds.Add(condominium.Id);
        return condominium;
    }

    private User NewUser(IEncryptionService encryption, UserRole role, Guid? condominiumId)
    {
        var email = $"user-{Guid.NewGuid():N}@test.local";
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User",
            EmailEncrypted = encryption.Encrypt(EmailHashHelper.Normalize(email)),
            EmailHash = EmailHashHelper.GenerateEmailHash(email),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("StrongPass123!"),
            Role = role,
            IsActive = true,
            CondominiumId = condominiumId,
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        };

        _userIds.Add(user.Id);
        return user;
    }

    public void Dispose()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HabitusDbContext>();

        DeleteTracked(() => db.Notifications.Where(n => _condominiumIds.Contains(n.CondominiumId) || (_userIds.Contains(n.TargetUserId ?? Guid.Empty))).ExecuteDelete());
        DeleteTracked(() => db.UserCondominiumAssociationRequests.Where(r => _associationRequestIds.Contains(r.Id) || _userIds.Contains(r.RequesterUserId)).ExecuteDelete());
        DeleteTracked(() => db.UserCondominiums.Where(uc => _userIds.Contains(uc.UserId) || _condominiumIds.Contains(uc.CondominiumId)).ExecuteDelete());
        DeleteTracked(() => db.UserConsents.Where(uc => _userIds.Contains(uc.UserId)).ExecuteDelete());
        DeleteTracked(() => db.Users.Where(u => _userIds.Contains(u.Id)).ExecuteDelete());
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
            // Best effort cleanup.
        }
    }

    private sealed class AssociationRequestPayload
    {
        public Guid RequesterUserId { get; set; }
        public Guid TargetCondominiumId { get; set; }
        public int Status { get; set; }
    }
}

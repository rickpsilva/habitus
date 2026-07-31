using FluentAssertions;
using Habitus.Application.DTOs.PersonalData;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

/// <summary>
/// Unit tests for <see cref="PersonalDataService"/>: the GDPR/RGPD export shape (no secrets,
/// decrypted contact fields), full vs partial erasure field effects, the anonymization sentinel,
/// the append-only audit record and the erasure auth/phrase gates. Covers REQ-SEC-003/004.
/// </summary>
public class PersonalDataServiceTests
{
    private readonly Mock<IRepository<User>> _users = new();
    private readonly Mock<IRepository<UnitMembership>> _memberships = new();
    private readonly Mock<IRepository<UserCondominium>> _userCondominiums = new();
    private readonly Mock<IRepository<UserAuthProvider>> _authProviders = new();
    private readonly Mock<IRepository<UserRecoveryCode>> _recoveryCodes = new();
    private readonly Mock<IRepository<AuthChallenge>> _authChallenges = new();
    private readonly Mock<IRepository<UserConsent>> _consents = new();
    private readonly Mock<IRepository<MaintenanceRequest>> _maintenance = new();
    private readonly Mock<IRepository<Reservation>> _reservations = new();
    private readonly Mock<IRepository<Payment>> _payments = new();
    private readonly Mock<IRepository<PersonalDataRequest>> _requests = new();
    private readonly Mock<IEncryptionService> _encryption = new();

    private readonly List<PersonalDataRequest> _appended = new();
    private readonly Guid _condoId = Guid.NewGuid();

    public PersonalDataServiceTests()
    {
        // Default empty result sets so the aggregation never hits an unconfigured mock.
        _memberships.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<UnitMembership, bool>>>()))
            .ReturnsAsync(new List<UnitMembership>());
        _userCondominiums.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<UserCondominium, bool>>>()))
            .ReturnsAsync(new List<UserCondominium>());
        _authProviders.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<UserAuthProvider, bool>>>()))
            .ReturnsAsync(new List<UserAuthProvider>());
        _recoveryCodes.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<UserRecoveryCode, bool>>>()))
            .ReturnsAsync(new List<UserRecoveryCode>());
        _authChallenges.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<AuthChallenge, bool>>>()))
            .ReturnsAsync(new List<AuthChallenge>());
        _consents.Setup(r => r.FindWithIncludesAsync(It.IsAny<System.Linq.Expressions.Expression<Func<UserConsent, bool>>>(), It.IsAny<string[]>()))
            .ReturnsAsync(new List<UserConsent>());
        _maintenance.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<MaintenanceRequest, bool>>>()))
            .ReturnsAsync(new List<MaintenanceRequest>());
        _reservations.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Reservation, bool>>>()))
            .ReturnsAsync(new List<Reservation>());
        _payments.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Payment, bool>>>()))
            .ReturnsAsync(new List<Payment>());
        _requests.Setup(r => r.AddAsync(It.IsAny<PersonalDataRequest>()))
            .Callback<PersonalDataRequest>(r => _appended.Add(r))
            .Returns(Task.CompletedTask);

        // Encryption mock: "enc:" prefix marks encrypted values; decrypt strips it.
        _encryption.Setup(e => e.Decrypt(It.IsAny<string>()))
            .Returns<string>(v => v.StartsWith("enc:") ? v.Substring(4) : v);
    }

    private PersonalDataService CreateService() => new(
        _users.Object, _memberships.Object, _userCondominiums.Object, _authProviders.Object,
        _recoveryCodes.Object, _authChallenges.Object, _consents.Object, _maintenance.Object,
        _reservations.Object, _payments.Object, _requests.Object, _encryption.Object);

    private User NewUser(string password = "hashed", bool social = false) => new()
    {
        Id = Guid.NewGuid(),
        Name = "Alice Resident",
        EmailEncrypted = "enc:alice@test.local",
        EmailHash = "hash",
        PhoneEncrypted = "enc:+351911111111",
        PasswordHash = social ? string.Empty : BCrypt.Net.BCrypt.HashPassword(password),
        PreferredLanguage = "pt",
        Role = UserRole.Resident,
        IsActive = true,
        CondominiumId = _condoId,
        UnitId = Guid.NewGuid(),
        TwoFactorEnabled = true,
        TwoFactorSecretEncrypted = "enc:secret"
    };

    // ── Export ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task ExportAsync_ReturnsAllTopLevelSections_WithDecryptedContactAndNoSecrets()
    {
        var user = NewUser();
        _users.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);

        var result = await CreateService().ExportAsync(user.Id);

        result.ExportMetadata.Should().NotBeNull();
        result.ExportMetadata.SubjectUserId.Should().Be(user.Id);
        result.ExportMetadata.CondominiumScope.Should().Contain(_condoId);
        result.Profile.Should().NotBeNull();
        result.Memberships.Should().NotBeNull();
        result.Consents.Should().NotBeNull();
        result.Records.Should().NotBeNull();

        result.Profile.Email.Should().Be("alice@test.local");
        result.Profile.Phone.Should().Be("+351911111111");

        // No secret ever leaves the system: the export type exposes no password/2FA/token members.
        var members = typeof(ProfileDto).GetProperties().Select(p => p.Name);
        members.Should().NotContain(n => n.Contains("Password") || n.Contains("Token") || n.Contains("TwoFactor") || n.Contains("Secret"));
    }

    [Fact]
    public async Task ExportAsync_OnlyIncludesRecordsWithinSubjectCondominiumScope()
    {
        var user = NewUser();
        _users.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);

        var inScope = new Payment { Id = Guid.NewGuid(), ResidentId = user.Id, CondominiumId = _condoId, Amount = 50m, Description = "Quota" };
        var outOfScope = new Payment { Id = Guid.NewGuid(), ResidentId = user.Id, CondominiumId = Guid.NewGuid(), Amount = 99m, Description = "Other" };
        _payments.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Payment, bool>>>()))
            .ReturnsAsync(new List<Payment> { inScope, outOfScope });

        var result = await CreateService().ExportAsync(user.Id);

        result.Records.Payments.Should().ContainSingle();
        result.Records.Payments[0].Id.Should().Be(inScope.Id);
    }

    // ── Full erasure ────────────────────────────────────────────────────────

    [Fact]
    public async Task EraseAsync_Full_AnonymizesUserWithSentinelAndDisablesLogin()
    {
        var user = NewUser();
        _users.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _users.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await CreateService().EraseAsync(
            user.Id, user.Id, ErasureType.Full, null, "ELIMINAR", "hashed", "1.2.3.4", "agent");

        result.Type.Should().Be(ErasureType.Full);
        result.LoginDisabled.Should().BeTrue();

        user.Name.Should().Be("Unknown User");
        user.EmailEncrypted.Should().BeNull();
        user.EmailHash.Should().BeNull();
        user.PhoneEncrypted.Should().BeNull();
        user.PasswordHash.Should().BeEmpty();
        user.TwoFactorEnabled.Should().BeFalse();
        user.TwoFactorSecretEncrypted.Should().BeNull();
        user.PreferredLanguage.Should().BeNull();
        user.IsActive.Should().BeFalse();
        user.IsAnonymized.Should().BeTrue();
        user.AnonymizedAt.Should().NotBeNull();
        user.CondominiumId.Should().BeNull();
        user.UnitId.Should().BeNull();
    }

    [Fact]
    public async Task EraseAsync_Full_AppendsErasureFullAuditRecord()
    {
        var user = NewUser();
        _users.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _users.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        await CreateService().EraseAsync(user.Id, user.Id, ErasureType.Full, null, "ELIMINAR", "hashed", "1.2.3.4", "agent");

        _appended.Should().ContainSingle();
        _appended[0].RequestType.Should().Be(PersonalDataRequestType.ErasureFull);
        _appended[0].UserId.Should().Be(user.Id);
        _appended[0].ActorUserId.Should().Be(user.Id);
        _appended[0].IpAddress.Should().Be("1.2.3.4");
        _users.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    // ── Partial erasure ───────────────────────────────────────────────────────

    [Fact]
    public async Task EraseAsync_Partial_RemovesOnlyPhoneAndKeepsAccountActive()
    {
        var user = NewUser();
        _users.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _users.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await CreateService().EraseAsync(
            user.Id, user.Id, ErasureType.Partial, new[] { "phone" }, "ELIMINAR", "hashed", null, null);

        result.Type.Should().Be(ErasureType.Partial);
        result.LoginDisabled.Should().BeFalse();

        user.PhoneEncrypted.Should().BeNull();
        // Identity-critical fields are retained; account stays active.
        user.EmailEncrypted.Should().NotBeNull();
        user.EmailHash.Should().NotBeNull();
        user.Name.Should().Be("Alice Resident");
        user.IsActive.Should().BeTrue();
        user.IsAnonymized.Should().BeFalse();
        _appended[0].RequestType.Should().Be(PersonalDataRequestType.ErasurePartial);
    }

    // ── Auth / phrase gates ─────────────────────────────────────────────────

    [Fact]
    public async Task EraseAsync_WrongConfirmationPhrase_Throws()
    {
        var user = NewUser();
        _users.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);

        var act = async () => await CreateService().EraseAsync(
            user.Id, user.Id, ErasureType.Full, null, "WRONG", "hashed", null, null);

        (await act.Should().ThrowAsync<ErasureValidationException>()).Which.Code.Should().Be("invalid_confirmation_phrase");
        _users.Verify(r => r.SaveChangesAsync(), Times.Never);
    }

    [Fact]
    public async Task EraseAsync_PasswordAccount_MissingPassword_Throws()
    {
        var user = NewUser();
        _users.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);

        var act = async () => await CreateService().EraseAsync(
            user.Id, user.Id, ErasureType.Full, null, "ELIMINAR", null, null, null);

        (await act.Should().ThrowAsync<ErasureValidationException>()).Which.Code.Should().Be("password_required");
    }

    [Fact]
    public async Task EraseAsync_PasswordAccount_WrongPassword_Throws()
    {
        var user = NewUser();
        _users.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);

        var act = async () => await CreateService().EraseAsync(
            user.Id, user.Id, ErasureType.Full, null, "ELIMINAR", "not-the-password", null, null);

        (await act.Should().ThrowAsync<ErasureValidationException>()).Which.Code.Should().Be("invalid_password");
    }

    [Fact]
    public async Task EraseAsync_SocialLoginAccount_NoPasswordRequired_Succeeds()
    {
        var user = NewUser(social: true);
        _users.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _users.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var result = await CreateService().EraseAsync(
            user.Id, user.Id, ErasureType.Full, null, "ELIMINAR", null, null, null);

        result.LoginDisabled.Should().BeTrue();
        user.IsAnonymized.Should().BeTrue();
    }
}

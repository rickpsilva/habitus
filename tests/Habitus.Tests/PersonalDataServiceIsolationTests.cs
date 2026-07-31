using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.PersonalData;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

/// <summary>
/// Multi-condominium isolation tests for <see cref="PersonalDataService"/>: an export must include
/// ONLY the subject's own records within the subject's condominium scope (never other tenants'
/// data), and a full erasure must never mutate other users' rows nor destroy retained financial
/// records. Covers REQ-SEC-003/004 tenant-isolation guardrails.
/// </summary>
public class PersonalDataServiceIsolationTests
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

    private readonly Guid _condoA = Guid.NewGuid();
    private readonly Guid _condoB = Guid.NewGuid();
    private readonly Guid _subjectId = Guid.NewGuid();
    private readonly Guid _otherUserId = Guid.NewGuid();

    public PersonalDataServiceIsolationTests()
    {
        _userCondominiums.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCondominium, bool>>>()))
            .ReturnsAsync(new List<UserCondominium>());
        _authProviders.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserAuthProvider, bool>>>()))
            .ReturnsAsync(new List<UserAuthProvider>());
        _recoveryCodes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserRecoveryCode, bool>>>()))
            .ReturnsAsync(new List<UserRecoveryCode>());
        _authChallenges.Setup(r => r.FindAsync(It.IsAny<Expression<Func<AuthChallenge, bool>>>()))
            .ReturnsAsync(new List<AuthChallenge>());
        _consents.Setup(r => r.FindWithIncludesAsync(It.IsAny<Expression<Func<UserConsent, bool>>>(), It.IsAny<string[]>()))
            .ReturnsAsync(new List<UserConsent>());
        _maintenance.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MaintenanceRequest, bool>>>()))
            .ReturnsAsync(new List<MaintenanceRequest>());
        _reservations.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Reservation, bool>>>()))
            .ReturnsAsync(new List<Reservation>());
        _requests.Setup(r => r.AddAsync(It.IsAny<PersonalDataRequest>())).Returns(Task.CompletedTask);
        _encryption.Setup(e => e.Decrypt(It.IsAny<string>())).Returns<string>(v => v);
    }

    private PersonalDataService CreateService() => new(
        _users.Object, _memberships.Object, _userCondominiums.Object, _authProviders.Object,
        _recoveryCodes.Object, _authChallenges.Object, _consents.Object, _maintenance.Object,
        _reservations.Object, _payments.Object, _requests.Object, _encryption.Object);

    private User Subject() => new()
    {
        Id = _subjectId,
        Name = "Subject",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword("pw"),
        Role = UserRole.Resident,
        IsActive = true,
        CondominiumId = _condoA,
        UnitId = Guid.NewGuid()
    };

    [Fact]
    public async Task ExportAsync_ExcludesRecordsFromOtherCondominiums()
    {
        var subject = Subject();
        _users.Setup(r => r.GetByIdAsync(_subjectId)).ReturnsAsync(subject);

        // The subject belongs to condo A only. A stray record in condo B must be excluded even if
        // it references the subject id (defence-in-depth scope intersection).
        _maintenance.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MaintenanceRequest, bool>>>()))
            .ReturnsAsync(new List<MaintenanceRequest>
            {
                new() { Id = Guid.NewGuid(), CreatedBy = _subjectId, CondominiumId = _condoA, UnitId = Guid.NewGuid(), Title = "A" },
                new() { Id = Guid.NewGuid(), CreatedBy = _subjectId, CondominiumId = _condoB, UnitId = Guid.NewGuid(), Title = "B" },
            });

        var result = await CreateService().ExportAsync(_subjectId);

        result.Records.MaintenanceRequests.Should().ContainSingle();
        result.Records.MaintenanceRequests[0].CondominiumId.Should().Be(_condoA);
    }

    [Fact]
    public async Task ExportAsync_QueriesOnlyBySubjectId_NeverOtherUsers()
    {
        var subject = Subject();
        _users.Setup(r => r.GetByIdAsync(_subjectId)).ReturnsAsync(subject);
        _payments.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Payment, bool>>>()))
            .ReturnsAsync(new List<Payment>());

        await CreateService().ExportAsync(_subjectId);

        // Every record query filters by the subject id; the other user's id is never used.
        var subjectPredicate = new Func<Expression<Func<Payment, bool>>, bool>(expr =>
        {
            var f = expr.Compile();
            return f(new Payment { ResidentId = _subjectId }) && !f(new Payment { ResidentId = _otherUserId });
        });
        _payments.Verify(r => r.FindAsync(It.Is<Expression<Func<Payment, bool>>>(e => subjectPredicate(e))), Times.Once);
    }

    [Fact]
    public async Task EraseAsync_Full_DoesNotTouchPaymentsOrOtherUsers()
    {
        var subject = Subject();
        _users.Setup(r => r.GetByIdAsync(_subjectId)).ReturnsAsync(subject);
        _users.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _memberships.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UnitMembership, bool>>>()))
            .ReturnsAsync(new List<UnitMembership>());

        await CreateService().EraseAsync(_subjectId, _subjectId, ErasureType.Full, null, "ELIMINAR", "pw", null, null);

        // Financial records are retained: the service never removes/updates any Payment row.
        _payments.Verify(r => r.Remove(It.IsAny<Payment>()), Times.Never);
        _payments.Verify(r => r.Update(It.IsAny<Payment>()), Times.Never);
        // No other user's row is loaded or updated.
        _users.Verify(r => r.Update(It.Is<User>(u => u.Id == _subjectId)), Times.Once);
        _users.Verify(r => r.Update(It.Is<User>(u => u.Id == _otherUserId)), Times.Never);
    }
}

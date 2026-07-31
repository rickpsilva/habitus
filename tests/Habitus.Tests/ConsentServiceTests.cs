using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Consents;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

/// <summary>
/// Unit tests for <see cref="ConsentService"/>, the RGPD/GDPR consent gate. Verifies the
/// append-only history semantics (latest decision wins), that only active mandatory definitions
/// gate access, latest-version-per-key selection, and per-user isolation. Covers REQ-SEC-005 and
/// REQ-AUTH-005.
/// </summary>
public class ConsentServiceTests
{
    private readonly Mock<IRepository<ConsentDefinition>> _definitionsMock = new();
    private readonly Mock<IRepository<UserConsent>> _consentsMock = new();
    private readonly ConsentService _service;

    private readonly Guid _userId = Guid.NewGuid();

    public ConsentServiceTests()
    {
        _consentsMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _definitionsMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _service = new ConsentService(_definitionsMock.Object, _consentsMock.Object);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static ConsentDefinition Def(string key, string version, bool mandatory, bool active = true, DateTime? createdAt = null) => new()
    {
        Id = Guid.NewGuid(),
        Key = key,
        Version = version,
        Title = $"{key} {version}",
        IsMandatory = mandatory,
        IsActive = active,
        CreatedAt = createdAt ?? DateTime.UtcNow
    };

    private static UserConsent Decision(Guid userId, Guid definitionId, bool accepted, DateTime decidedAt) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        ConsentDefinitionId = definitionId,
        Accepted = accepted,
        DecidedAt = decidedAt
    };

    /// <summary>Configures the definition repository to return <paramref name="all"/> filtered by the predicate.</summary>
    private void SetupDefinitions(params ConsentDefinition[] all) =>
        _definitionsMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<ConsentDefinition, bool>>>()))
            .ReturnsAsync((Expression<Func<ConsentDefinition, bool>> predicate) =>
                all.Where(predicate.Compile()).ToList());

    /// <summary>Configures the consent repository to return <paramref name="all"/> filtered by the predicate.</summary>
    private void SetupConsents(params UserConsent[] all) =>
        _consentsMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserConsent, bool>>>()))
            .ReturnsAsync((Expression<Func<UserConsent, bool>> predicate) =>
                all.Where(predicate.Compile()).ToList());

    // ── HasAllMandatoryConsentsAsync ───────────────────────────────────────────

    [Fact]
    public async Task HasAllMandatoryConsents_WhenMandatoryNeverAccepted_ReturnsFalse()
    {
        var terms = Def("terms", "1.0", mandatory: true);
        SetupDefinitions(terms);
        SetupConsents(); // no decisions at all

        (await _service.HasAllMandatoryConsentsAsync(_userId)).Should().BeFalse();
    }

    [Fact]
    public async Task HasAllMandatoryConsents_WhenLatestDecisionIsWithdrawal_ReturnsFalse()
    {
        var terms = Def("terms", "1.0", mandatory: true);
        SetupDefinitions(terms);
        // Accepted first, later withdrawn: append-only, latest decision wins.
        SetupConsents(
            Decision(_userId, terms.Id, accepted: true, decidedAt: DateTime.UtcNow.AddHours(-2)),
            Decision(_userId, terms.Id, accepted: false, decidedAt: DateTime.UtcNow.AddHours(-1)));

        (await _service.HasAllMandatoryConsentsAsync(_userId)).Should().BeFalse();
    }

    [Fact]
    public async Task HasAllMandatoryConsents_WhenAllMandatoryLatestAccepted_ReturnsTrue()
    {
        var terms = Def("terms", "1.0", mandatory: true);
        var privacy = Def("privacy", "1.0", mandatory: true);
        SetupDefinitions(terms, privacy);
        SetupConsents(
            Decision(_userId, terms.Id, accepted: true, decidedAt: DateTime.UtcNow.AddMinutes(-5)),
            Decision(_userId, privacy.Id, accepted: true, decidedAt: DateTime.UtcNow.AddMinutes(-4)));

        (await _service.HasAllMandatoryConsentsAsync(_userId)).Should().BeTrue();
    }

    [Fact]
    public async Task HasAllMandatoryConsents_WhenWithdrawnThenReAccepted_ReturnsTrue()
    {
        var terms = Def("terms", "1.0", mandatory: true);
        SetupDefinitions(terms);
        // accept → withdraw → accept again: the newest row is an acceptance.
        SetupConsents(
            Decision(_userId, terms.Id, accepted: true, decidedAt: DateTime.UtcNow.AddHours(-3)),
            Decision(_userId, terms.Id, accepted: false, decidedAt: DateTime.UtcNow.AddHours(-2)),
            Decision(_userId, terms.Id, accepted: true, decidedAt: DateTime.UtcNow.AddHours(-1)));

        (await _service.HasAllMandatoryConsentsAsync(_userId)).Should().BeTrue();
    }

    [Fact]
    public async Task HasAllMandatoryConsents_IgnoresNonMandatoryDefinitions()
    {
        var terms = Def("terms", "1.0", mandatory: true);
        var marketing = Def("marketing", "1.0", mandatory: false);
        SetupDefinitions(terms, marketing);
        // Only the mandatory 'terms' is accepted; the optional 'marketing' is never decided.
        SetupConsents(Decision(_userId, terms.Id, accepted: true, decidedAt: DateTime.UtcNow));

        (await _service.HasAllMandatoryConsentsAsync(_userId)).Should().BeTrue();
    }

    [Fact]
    public async Task HasAllMandatoryConsents_IgnoresInactiveMandatoryDefinitions()
    {
        var retired = Def("terms", "0.9", mandatory: true, active: false);
        SetupDefinitions(retired);
        SetupConsents(); // no decisions

        // No ACTIVE mandatory definitions -> gate is satisfied.
        (await _service.HasAllMandatoryConsentsAsync(_userId)).Should().BeTrue();
    }

    [Fact]
    public async Task HasAllMandatoryConsents_WhenNewMandatoryVersionPublished_RequiresReConsent()
    {
        var v1 = Def("terms", "1.0", mandatory: true, createdAt: DateTime.UtcNow.AddDays(-10));
        var v2 = Def("terms", "2.0", mandatory: true, createdAt: DateTime.UtcNow.AddDays(-1));
        SetupDefinitions(v1, v2);
        // User accepted only the old version; the currently-required version is v2.
        SetupConsents(Decision(_userId, v1.Id, accepted: true, decidedAt: DateTime.UtcNow.AddDays(-9)));

        (await _service.HasAllMandatoryConsentsAsync(_userId)).Should().BeFalse();
    }

    [Fact]
    public async Task HasAllMandatoryConsents_IsPerUser_OneUsersConsentDoesNotSatisfyAnother()
    {
        var terms = Def("terms", "1.0", mandatory: true);
        SetupDefinitions(terms);
        var otherUserId = Guid.NewGuid();
        // Only the OTHER user accepted; the target user has no decision.
        SetupConsents(Decision(otherUserId, terms.Id, accepted: true, decidedAt: DateTime.UtcNow));

        (await _service.HasAllMandatoryConsentsAsync(_userId)).Should().BeFalse();
        (await _service.HasAllMandatoryConsentsAsync(otherUserId)).Should().BeTrue();
    }

    // ── GetConsentStatusAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task GetConsentStatus_ReflectsLatestDecisionAndMandatoryFlag()
    {
        var terms = Def("terms", "1.0", mandatory: true);
        var marketing = Def("marketing", "1.0", mandatory: false);
        SetupDefinitions(terms, marketing);
        SetupConsents(
            Decision(_userId, terms.Id, accepted: true, decidedAt: DateTime.UtcNow.AddMinutes(-2)),
            Decision(_userId, marketing.Id, accepted: false, decidedAt: DateTime.UtcNow.AddMinutes(-1)));

        var status = await _service.GetConsentStatusAsync(_userId);

        status.AllMandatoryAccepted.Should().BeTrue();
        status.Consents.Should().HaveCount(2);
        status.Consents.Single(c => c.Key == "terms").Decision.Should().Be(ConsentDecision.Accepted);
        status.Consents.Single(c => c.Key == "marketing").Decision.Should().Be(ConsentDecision.Withdrawn);
    }

    [Fact]
    public async Task GetConsentStatus_SurfacesLatestVersionPerKeyOnly()
    {
        var v1 = Def("terms", "1.0", mandatory: true, createdAt: DateTime.UtcNow.AddDays(-10));
        var v2 = Def("terms", "2.0", mandatory: true, createdAt: DateTime.UtcNow.AddDays(-1));
        SetupDefinitions(v1, v2);
        SetupConsents();

        var status = await _service.GetConsentStatusAsync(_userId);

        status.Consents.Should().ContainSingle(c => c.Key == "terms");
        status.Consents.Single().Version.Should().Be("2.0");
        status.Consents.Single().Decision.Should().Be(ConsentDecision.None);
        status.AllMandatoryAccepted.Should().BeFalse();
    }

    [Fact]
    public async Task GetConsentStatus_MapsUrlAndBodyFromDefinition()
    {
        var terms = Def("terms", "1.0", mandatory: true);
        terms.Url = "https://example.test/terms";
        terms.Body = "# Termos\n\nCorpo do documento.";
        SetupDefinitions(terms);
        SetupConsents();

        var status = await _service.GetConsentStatusAsync(_userId);

        var item = status.Consents.Single(c => c.Key == "terms");
        item.Url.Should().Be("https://example.test/terms");
        item.Body.Should().Be("# Termos\n\nCorpo do documento.");
    }

    // ── RecordConsentAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task RecordConsent_AppendsRow_ForActiveDefinition()
    {
        var terms = Def("terms", "1.0", mandatory: true);
        _definitionsMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ConsentDefinition, bool>>>()))
            .ReturnsAsync((Expression<Func<ConsentDefinition, bool>> predicate) =>
                new[] { terms }.FirstOrDefault(predicate.Compile()));

        UserConsent? added = null;
        _consentsMock.Setup(r => r.AddAsync(It.IsAny<UserConsent>()))
            .Callback<UserConsent>(c => added = c)
            .Returns(Task.CompletedTask);

        await _service.RecordConsentAsync(_userId, "terms", "1.0", accepted: true, "1.2.3.4", "agent");

        added.Should().NotBeNull();
        added!.UserId.Should().Be(_userId);
        added.ConsentDefinitionId.Should().Be(terms.Id);
        added.Accepted.Should().BeTrue();
        added.IpAddress.Should().Be("1.2.3.4");
        added.UserAgent.Should().Be("agent");
        _consentsMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task RecordConsent_ForUnknownDefinition_Throws()
    {
        _definitionsMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ConsentDefinition, bool>>>()))
            .ReturnsAsync((ConsentDefinition?)null);

        var act = () => _service.RecordConsentAsync(_userId, "terms", "9.9", accepted: true);

        await act.Should().ThrowAsync<InvalidOperationException>();
        _consentsMock.Verify(r => r.AddAsync(It.IsAny<UserConsent>()), Times.Never);
    }

    // ── Manager authoring: ListDefinitionsAsync (REQ-SEC-008) ──────────────────

    /// <summary>Configures the definition repository's GetAllAsync to return <paramref name="all"/>.</summary>
    private void SetupAllDefinitions(params ConsentDefinition[] all) =>
        _definitionsMock.Setup(r => r.GetAllAsync()).ReturnsAsync(all);

    [Fact]
    public async Task ListDefinitions_ReturnsAllVersionsIncludingBodies()
    {
        var v1 = Def("terms", "1.0", mandatory: true, createdAt: DateTime.UtcNow.AddDays(-10));
        v1.Body = "Old body";
        var v2 = Def("terms", "2.0", mandatory: true, createdAt: DateTime.UtcNow.AddDays(-1));
        v2.Body = "New body";
        var retired = Def("privacy", "0.9", mandatory: true, active: false);
        SetupAllDefinitions(v1, v2, retired);

        var result = await _service.ListDefinitionsAsync();

        result.Should().HaveCount(3);
        result.Should().Contain(d => d.Version == "1.0" && d.Body == "Old body");
        result.Should().Contain(d => d.Version == "2.0" && d.Body == "New body");
        result.Should().Contain(d => d.Key == "privacy" && !d.IsActive);
    }

    // ── Manager authoring: UpdateDefinitionInPlaceAsync ────────────────────────

    [Fact]
    public async Task UpdateInPlace_ChangesTextAndStampsAudit_LeavesKeyVersionCreatedAtUnchanged()
    {
        var createdAt = DateTime.UtcNow.AddDays(-5);
        var def = Def("terms", "1.0", mandatory: true, createdAt: createdAt);
        def.Title = "Old Title";
        def.Url = "https://old.test";
        def.Body = "Old body";
        _definitionsMock.Setup(r => r.GetByIdAsync(def.Id)).ReturnsAsync(def);

        var actingUser = Guid.NewGuid();
        var result = await _service.UpdateDefinitionInPlaceAsync(
            def.Id,
            new UpdateConsentDefinitionRequest { Title = "New Title", Url = "https://new.test", Body = "New body" },
            actingUser);

        // Text changed.
        def.Title.Should().Be("New Title");
        def.Url.Should().Be("https://new.test");
        def.Body.Should().Be("New body");
        // Identity/version/creation preserved.
        def.Key.Should().Be("terms");
        def.Version.Should().Be("1.0");
        def.CreatedAt.Should().Be(createdAt);
        // Audit stamped.
        def.UpdatedByUserId.Should().Be(actingUser);
        def.UpdatedAt.Should().NotBeNull();
        result.Title.Should().Be("New Title");
        _definitionsMock.Verify(r => r.Update(def), Times.Once);
        _definitionsMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task UpdateInPlace_DoesNotChangeWhichVersionIsLatest()
    {
        var v1 = Def("terms", "1.0", mandatory: true, createdAt: DateTime.UtcNow.AddDays(-10));
        var v2 = Def("terms", "2.0", mandatory: true, createdAt: DateTime.UtcNow.AddDays(-1));
        _definitionsMock.Setup(r => r.GetByIdAsync(v1.Id)).ReturnsAsync(v1);

        await _service.UpdateDefinitionInPlaceAsync(
            v1.Id, new UpdateConsentDefinitionRequest { Title = "Fixed typo", Body = "Corrected" }, Guid.NewGuid());

        // The status view still surfaces v2 as latest (edit to v1 did not touch CreatedAt/Version).
        SetupDefinitions(v1, v2);
        SetupConsents();
        var status = await _service.GetConsentStatusAsync(_userId);
        status.Consents.Single(c => c.Key == "terms").Version.Should().Be("2.0");
    }

    [Fact]
    public async Task UpdateInPlace_WhenIdUnknown_ThrowsNotFound()
    {
        _definitionsMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((ConsentDefinition?)null);

        var act = () => _service.UpdateDefinitionInPlaceAsync(
            Guid.NewGuid(), new UpdateConsentDefinitionRequest { Title = "x" }, Guid.NewGuid());

        (await act.Should().ThrowAsync<ConsentAuthoringException>()).Which.Code.Should().Be("not_found");
        _definitionsMock.Verify(r => r.Update(It.IsAny<ConsentDefinition>()), Times.Never);
    }

    // ── Manager authoring: PublishNewVersionAsync ──────────────────────────────

    [Fact]
    public async Task PublishNewVersion_AddsActiveRowWithAudit_DoesNotMutatePriorRowsOrHistory()
    {
        _definitionsMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ConsentDefinition, bool>>>()))
            .ReturnsAsync((ConsentDefinition?)null); // no duplicate

        ConsentDefinition? added = null;
        _definitionsMock.Setup(r => r.AddAsync(It.IsAny<ConsentDefinition>()))
            .Callback<ConsentDefinition>(d => added = d)
            .Returns(Task.CompletedTask);

        var actingUser = Guid.NewGuid();
        var result = await _service.PublishNewVersionAsync(
            new PublishConsentVersionRequest
            {
                Key = "terms",
                Version = "3.0",
                Title = "Terms v3",
                Body = "Body v3",
                IsMandatory = true
            },
            actingUser);

        added.Should().NotBeNull();
        added!.Id.Should().NotBe(Guid.Empty);
        added.Key.Should().Be("terms");
        added.Version.Should().Be("3.0");
        added.IsActive.Should().BeTrue();
        added.CreatedByUserId.Should().Be(actingUser);
        added.UpdatedAt.Should().BeNull();
        result.Version.Should().Be("3.0");
        _definitionsMock.Verify(r => r.AddAsync(It.IsAny<ConsentDefinition>()), Times.Once);
        _definitionsMock.Verify(r => r.SaveChangesAsync(), Times.Once);
        // Publication never touches the append-only UserConsent history.
        _consentsMock.Verify(r => r.AddAsync(It.IsAny<UserConsent>()), Times.Never);
        _consentsMock.Verify(r => r.SaveChangesAsync(), Times.Never);
    }

    [Fact]
    public async Task PublishNewVersion_WhenKeyVersionAlreadyExists_ThrowsDuplicate()
    {
        var existing = Def("terms", "1.0", mandatory: true);
        _definitionsMock
            .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ConsentDefinition, bool>>>()))
            .ReturnsAsync((Expression<Func<ConsentDefinition, bool>> predicate) =>
                new[] { existing }.FirstOrDefault(predicate.Compile()));

        var act = () => _service.PublishNewVersionAsync(
            new PublishConsentVersionRequest { Key = "terms", Version = "1.0", Title = "dup", IsMandatory = true },
            Guid.NewGuid());

        (await act.Should().ThrowAsync<ConsentAuthoringException>()).Which.Code.Should().Be("duplicate_version");
        _definitionsMock.Verify(r => r.AddAsync(It.IsAny<ConsentDefinition>()), Times.Never);
        _definitionsMock.Verify(r => r.SaveChangesAsync(), Times.Never);
    }
}
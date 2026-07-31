using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Localization;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

/// <summary>
/// Unit tests for the localization language catalog and the shared
/// <see cref="FeatureEntitlementService"/> that resolves the <c>multilanguage</c> entitlement
/// (REQ-I18N-001): the active plan's features take precedence, the active Free plan is used as a
/// fallback, and a hardcoded free set applies when nothing is configured. Also covers the
/// supported-language validation used by the localization endpoints.
/// </summary>
public class LocalizationSettingsTests
{
    private readonly Mock<IRepository<CondominiumSubscription>> _subscriptionsRepo = new();
    private readonly Mock<IRepository<SubscriptionPlan>> _plansRepo = new();
    private readonly FeatureEntitlementService _service;

    public LocalizationSettingsTests()
    {
        _service = new FeatureEntitlementService(_subscriptionsRepo.Object, _plansRepo.Object);
    }

    private void SetupActiveSubscription(params CondominiumSubscription[] subs) =>
        _subscriptionsRepo
            .Setup(r => r.FindWithIncludesAsync(
                It.IsAny<Expression<Func<CondominiumSubscription, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync(subs);

    private void SetupFreePlan(params SubscriptionPlan[] plans) =>
        _plansRepo
            .Setup(r => r.FindWithIncludesAsync(
                It.IsAny<Expression<Func<SubscriptionPlan, bool>>>(),
                It.IsAny<string[]>()))
            .ReturnsAsync(plans);

    private static CondominiumSubscription SubWithFeature(Guid condominiumId, string key, bool enabled) =>
        new()
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Status = SubscriptionStatus.Active,
            StartDate = DateTime.UtcNow,
            Plan = new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Tier = PlanTier.Gold,
                Features = new List<PlanFeature>
                {
                    new() { FeatureKey = key, IsEnabled = enabled },
                },
            },
        };

    // ── Language validation ─────────────────────────────────────────────────────

    [Theory]
    [InlineData("pt", true)]
    [InlineData("en", true)]
    [InlineData("PT", true)]
    [InlineData("fr", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void LocalizationLanguages_IsSupported_MatchesCatalog(string? language, bool expected)
    {
        LocalizationLanguages.IsSupported(language).Should().Be(expected);
    }

    [Theory]
    [InlineData(null, "pt")]
    [InlineData("", "pt")]
    [InlineData("  ", "pt")]
    [InlineData("fr", "pt")]
    [InlineData("EN", "en")]
    [InlineData("pt", "pt")]
    public void LocalizationLanguages_NormalizeDefaultOrFallback_FallsBackToPortuguese(string? input, string expected)
    {
        LocalizationLanguages.NormalizeDefaultOrFallback(input).Should().Be(expected);
    }

    // ── Feature entitlement resolution ──────────────────────────────────────────

    [Fact]
    public async Task IsFeatureEnabled_WhenActivePlanHasFeatureEnabled_ReturnsTrue()
    {
        var condoId = Guid.NewGuid();
        SetupActiveSubscription(SubWithFeature(condoId, "multilanguage", enabled: true));

        var result = await _service.IsFeatureEnabledForCondominiumAsync(condoId, "multilanguage");

        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsFeatureEnabled_IsCaseInsensitiveOnKey()
    {
        var condoId = Guid.NewGuid();
        SetupActiveSubscription(SubWithFeature(condoId, "MultiLanguage", enabled: true));

        var result = await _service.IsFeatureEnabledForCondominiumAsync(condoId, "multilanguage");

        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsFeatureEnabled_WhenActivePlanHasFeatureDisabled_ReturnsFalse()
    {
        var condoId = Guid.NewGuid();
        SetupActiveSubscription(SubWithFeature(condoId, "multilanguage", enabled: false));

        var result = await _service.IsFeatureEnabledForCondominiumAsync(condoId, "multilanguage");

        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsFeatureEnabled_UsesLatestActiveSubscriptionByStartDate()
    {
        var condoId = Guid.NewGuid();
        var older = SubWithFeature(condoId, "multilanguage", enabled: false);
        older.StartDate = DateTime.UtcNow.AddDays(-10);
        var newer = SubWithFeature(condoId, "multilanguage", enabled: true);
        newer.StartDate = DateTime.UtcNow;
        SetupActiveSubscription(older, newer);

        var result = await _service.IsFeatureEnabledForCondominiumAsync(condoId, "multilanguage");

        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsFeatureEnabled_WhenNoSubscription_FallsBackToActiveFreePlan()
    {
        var condoId = Guid.NewGuid();
        SetupActiveSubscription();
        SetupFreePlan(new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Tier = PlanTier.Free,
            IsActive = true,
            Features = new List<PlanFeature>
            {
                new() { FeatureKey = "multilanguage", IsEnabled = true },
            },
        });

        var result = await _service.IsFeatureEnabledForCondominiumAsync(condoId, "multilanguage");

        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsFeatureEnabled_WhenNoSubscriptionAndNoFreePlan_UsesHardcodedFallbackSet()
    {
        var condoId = Guid.NewGuid();
        SetupActiveSubscription();
        SetupFreePlan();

        // "multilanguage" is not in the hardcoded free fallback set.
        (await _service.IsFeatureEnabledForCondominiumAsync(condoId, "multilanguage")).Should().BeFalse();
        // "maintenance" is in the hardcoded free fallback set.
        (await _service.IsFeatureEnabledForCondominiumAsync(condoId, "maintenance")).Should().BeTrue();
    }
}

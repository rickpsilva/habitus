using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Users;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class GdprConsentTests
{
    private readonly Mock<IRepository<User>> _userRepositoryMock = new();
    private readonly Mock<IRepository<UserCondominium>> _userCondominiumRepositoryMock = new();
    private readonly Mock<IRepository<Condominium>> _condominiumRepositoryMock = new();
    private readonly Mock<IRepository<Unit>> _unitRepositoryMock = new();
    private readonly Mock<IRepository<UserGdprConsent>> _userGdprConsentRepositoryMock = new();
    private readonly Mock<IRepository<Notification>> _notificationRepositoryMock = new();
    private readonly Mock<INotificationDispatchService> _notificationDispatchServiceMock = new();

    private readonly UserService _service;

    public GdprConsentTests()
    {
        _userRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userCondominiumRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _condominiumRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _unitRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _userGdprConsentRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _notificationRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        _service = new UserService(
            _userRepositoryMock.Object,
            _userCondominiumRepositoryMock.Object,
            _condominiumRepositoryMock.Object,
            _unitRepositoryMock.Object,
            _userGdprConsentRepositoryMock.Object,
            _notificationRepositoryMock.Object,
            _notificationDispatchServiceMock.Object);
    }

    [Fact]
    public async Task SaveGdprConsentAsync_WhenTermsNotAccepted_ShouldThrow()
    {
        var userId = Guid.NewGuid();
        _userRepositoryMock.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(new User { Id = userId, Name = "U", Email = "u@test.com", Phone = "911" });

        var act = () => _service.SaveGdprConsentAsync(userId, "127.0.0.1", new SaveGdprConsentRequest
        {
            AcceptedTerms = false,
            AcceptedPrivacyPolicy = true,
        });

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*aceitar termos e política de privacidade*");
    }

    [Fact]
    public async Task SaveGdprConsentAsync_WhenValid_ShouldPersistAndReturnStatus()
    {
        var userId = Guid.NewGuid();
        var storedConsents = new List<UserGdprConsent>();

        _userRepositoryMock.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(new User { Id = userId, Name = "U", Email = "u@test.com", Phone = "911" });
        _userGdprConsentRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<UserGdprConsent>()))
            .Callback<UserGdprConsent>(c => storedConsents.Add(c))
            .Returns(Task.CompletedTask);

        var result = await _service.SaveGdprConsentAsync(userId, "127.0.0.1", new SaveGdprConsentRequest
        {
            AcceptedTerms = true,
            AcceptedPrivacyPolicy = true,
        });

        result.HasConsent.Should().BeTrue();
        result.LastConsentedAt.Should().NotBeNull();
        storedConsents.Should().ContainSingle();
        storedConsents[0].UserId.Should().Be(userId);
        storedConsents[0].AcceptedTerms.Should().BeTrue();
        storedConsents[0].AcceptedPrivacyPolicy.Should().BeTrue();
        _userGdprConsentRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task HasGdprConsentAsync_WhenGuidInvalid_ShouldReturnFalse()
    {
        var hasConsent = await _service.HasGdprConsentAsync("not-a-guid");

        hasConsent.Should().BeFalse();
    }

    [Fact]
    public async Task HasGdprConsentAsync_WhenAcceptedConsentExists_ShouldReturnTrue()
    {
        var userId = Guid.NewGuid();
        var consents = new List<UserGdprConsent>
        {
            new()
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                AcceptedTerms = true,
                AcceptedPrivacyPolicy = true,
                ConsentedAt = DateTime.UtcNow,
                IpAddress = "127.0.0.1"
            }
        };

        _userGdprConsentRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserGdprConsent, bool>>>() ))
            .ReturnsAsync((Expression<Func<UserGdprConsent, bool>> predicate) => consents.Where(predicate.Compile()).ToList());

        var hasConsent = await _service.HasGdprConsentAsync(userId.ToString());

        hasConsent.Should().BeTrue();
    }
}

using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class CondominiumServiceCountAggregationTests
{
    private readonly Mock<IRepository<Condominium>> _condominiumRepository;
    private readonly Mock<IRepository<User>> _userRepository;
    private readonly Mock<IRepository<Unit>> _unitRepository;
    private readonly Mock<IRepository<PaymentSettings>> _paymentSettingsRepository;
    private readonly Mock<IEncryptionService> _encryptionService;
    private readonly CondominiumService _service;

    public CondominiumServiceCountAggregationTests()
    {
        _condominiumRepository = new Mock<IRepository<Condominium>>();
        _userRepository = new Mock<IRepository<User>>();
        _unitRepository = new Mock<IRepository<Unit>>();
        _paymentSettingsRepository = new Mock<IRepository<PaymentSettings>>();
        _encryptionService = new Mock<IEncryptionService>();

        // Focus on counts: decryption echoes its input back.
        _encryptionService
            .Setup(e => e.Decrypt(It.IsAny<string>()))
            .Returns<string>(value => value);

        _service = new CondominiumService(
            _condominiumRepository.Object,
            _userRepository.Object,
            _unitRepository.Object,
            _paymentSettingsRepository.Object,
            _encryptionService.Object);
    }

    [Fact]
    public async Task GetAllCondominiumsAsync_MapsGroupedCountsPerCondominiumById_WithoutN1Queries()
    {
        var condoA = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = "Condo A",
            AddressEncrypted = "addr-a",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        var condoB = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = "Condo B",
            AddressEncrypted = "addr-b",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        // condoC has no rows in either dictionary -> expected counts are 0.
        var condoC = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = "Condo C",
            AddressEncrypted = "addr-c",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _condominiumRepository
            .Setup(r => r.GetAllAsync())
            .ReturnsAsync(new[] { condoA, condoB, condoC });

        _unitRepository
            .Setup(r => r.CountGroupedAsync(
                It.IsAny<Expression<Func<Unit, Guid>>>(),
                It.IsAny<Expression<Func<Unit, bool>>>()))
            .ReturnsAsync(new Dictionary<Guid, int>
            {
                [condoA.Id] = 3,
                [condoB.Id] = 1
            });

        _userRepository
            .Setup(r => r.CountGroupedAsync(
                It.IsAny<Expression<Func<User, Guid>>>(),
                It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync(new Dictionary<Guid, int>
            {
                [condoA.Id] = 5,
                [condoB.Id] = 2
            });

        var result = (await _service.GetAllCondominiumsAsync()).ToList();

        result.Should().HaveCount(3);

        var responseA = result.Single(c => c.Id == condoA.Id);
        responseA.TotalUnits.Should().Be(3);
        responseA.TotalUsers.Should().Be(5);

        var responseB = result.Single(c => c.Id == condoB.Id);
        responseB.TotalUnits.Should().Be(1);
        responseB.TotalUsers.Should().Be(2);

        var responseC = result.Single(c => c.Id == condoC.Id);
        responseC.TotalUnits.Should().Be(0);
        responseC.TotalUsers.Should().Be(0);

        // Single grouped query per table, and no per-condominium N+1 entity loads.
        _unitRepository.Verify(r => r.CountGroupedAsync(
            It.IsAny<Expression<Func<Unit, Guid>>>(),
            It.IsAny<Expression<Func<Unit, bool>>>()), Times.Once);
        _userRepository.Verify(r => r.CountGroupedAsync(
            It.IsAny<Expression<Func<User, Guid>>>(),
            It.IsAny<Expression<Func<User, bool>>>()), Times.Once);
        _unitRepository.Verify(r => r.FindAsync(
            It.IsAny<Expression<Func<Unit, bool>>>()), Times.Never);
        _userRepository.Verify(r => r.FindAsync(
            It.IsAny<Expression<Func<User, bool>>>()), Times.Never);
    }
}

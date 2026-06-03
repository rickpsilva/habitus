using System.Linq.Expressions;
using FluentAssertions;
using Habitus.Application.DTOs.Condominium;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class CondominiumServiceAddressEncryptionTests
{
    private readonly Mock<IRepository<Condominium>> _condominiumRepository;
    private readonly Mock<IRepository<User>> _userRepository;
    private readonly Mock<IRepository<Unit>> _unitRepository;
    private readonly Mock<IRepository<PaymentSettings>> _paymentSettingsRepository;
    private readonly Mock<IEncryptionService> _encryptionService;
    private readonly CondominiumService _service;

    public CondominiumServiceAddressEncryptionTests()
    {
        _condominiumRepository = new Mock<IRepository<Condominium>>();
        _userRepository = new Mock<IRepository<User>>();
        _unitRepository = new Mock<IRepository<Unit>>();
        _paymentSettingsRepository = new Mock<IRepository<PaymentSettings>>();
        _encryptionService = new Mock<IEncryptionService>();

        _service = new CondominiumService(
            _condominiumRepository.Object,
            _userRepository.Object,
            _unitRepository.Object,
            _paymentSettingsRepository.Object,
            _encryptionService.Object);
    }

    [Fact]
    public async Task CreateCondominiumAsync_EncryptsAddressAndEmailAndStoresOnlyEncryptedValues()
    {
        var request = new CreateCondominiumRequest
        {
            Name = "Condominio Central",
            Address = "  Rua Principal 123  ",
            TaxId = "501234567",
            Email = "  geral@condominio.pt  "
        };

        Condominium? savedCondominium = null;

        _encryptionService
            .Setup(e => e.Encrypt("Rua Principal 123"))
            .Returns("enc-address");
        _encryptionService
            .Setup(e => e.Encrypt("501234567"))
            .Returns("enc-tax-id");
        _encryptionService
            .Setup(e => e.Encrypt("geral@condominio.pt"))
            .Returns("enc-email");
        _encryptionService
            .Setup(e => e.Decrypt("enc-address"))
            .Returns("Rua Principal 123");
        _encryptionService
            .Setup(e => e.Decrypt("enc-tax-id"))
            .Returns("501234567");
        _encryptionService
            .Setup(e => e.Decrypt("enc-email"))
            .Returns("geral@condominio.pt");

        _condominiumRepository
            .Setup(r => r.AddAsync(It.IsAny<Condominium>()))
            .Callback<Condominium>(c => savedCondominium = c)
            .Returns(Task.CompletedTask);

        _condominiumRepository
            .Setup(r => r.SaveChangesAsync())
            .ReturnsAsync(1);

        var result = await _service.CreateCondominiumAsync(request);

        savedCondominium.Should().NotBeNull();
        savedCondominium!.AddressEncrypted.Should().Be("enc-address");
        savedCondominium.Address.Should().BeEmpty();
        savedCondominium.EmailEncrypted.Should().Be("enc-email");
        savedCondominium.Email.Should().BeEmpty();

        result.Address.Should().Be("Rua Principal 123");
        result.TaxId.Should().Be("501234567");
        result.Email.Should().Be("geral@condominio.pt");
    }

    [Fact]
    public async Task GetAllCondominiumsAsync_ReturnsDecryptedAddressAndEmailWhenEncryptedFieldsExist()
    {
        var condominium = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = "Condominio Norte",
            Address = "legacy-address",
            AddressEncrypted = "enc-address",
            Email = "legacy@email.pt",
            EmailEncrypted = "enc-email",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _condominiumRepository
            .Setup(r => r.GetAllAsync())
            .ReturnsAsync(new[] { condominium });

        _userRepository
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync(Array.Empty<User>());

        _unitRepository
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Unit, bool>>>() ))
            .ReturnsAsync(Array.Empty<Unit>());

        _encryptionService
            .Setup(e => e.Decrypt("enc-address"))
            .Returns("Avenida Nova 999");
        _encryptionService
            .Setup(e => e.Decrypt("enc-email"))
            .Returns("novo@email.pt");

        var result = (await _service.GetAllCondominiumsAsync()).ToList();

        result.Should().HaveCount(1);
        result[0].Address.Should().Be("Avenida Nova 999");
        result[0].Email.Should().Be("novo@email.pt");
    }

    [Fact]
    public async Task UpdateCondominiumEmailAsync_EncryptsEmailAndClearsLegacyValue()
    {
        var condominium = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = "Condominio Sul",
            Address = string.Empty,
            AddressEncrypted = "enc-address",
            Email = "legacy@email.pt",
            EmailEncrypted = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _condominiumRepository
            .Setup(r => r.GetByIdAsync(condominium.Id))
            .ReturnsAsync(condominium);

        _condominiumRepository
            .Setup(r => r.SaveChangesAsync())
            .ReturnsAsync(1);

        _userRepository
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync(Array.Empty<User>());

        _unitRepository
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Unit, bool>>>() ))
            .ReturnsAsync(Array.Empty<Unit>());

        _encryptionService
            .Setup(e => e.Encrypt("admin@condominio.pt"))
            .Returns("enc-email");
        _encryptionService
            .Setup(e => e.Decrypt("enc-address"))
            .Returns("Rua Enc 1");
        _encryptionService
            .Setup(e => e.Decrypt("enc-email"))
            .Returns("admin@condominio.pt");

        var response = await _service.UpdateCondominiumEmailAsync(condominium.Id, "  admin@condominio.pt  ");

        condominium.EmailEncrypted.Should().Be("enc-email");
        condominium.Email.Should().BeEmpty();
        response.Email.Should().Be("admin@condominio.pt");
    }
}

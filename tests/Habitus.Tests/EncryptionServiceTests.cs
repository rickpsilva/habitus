using Habitus.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace Habitus.Tests;

public class EncryptionServiceTests
{
    [Fact]
    public void EncryptDecrypt_ShouldRoundTripPlaintext()
    {
        // Arrange
        var service = CreateService();
        const string plaintext = "123456789";

        // Act
        var encrypted = service.Encrypt(plaintext);
        var decrypted = service.Decrypt(encrypted);

        // Assert
        encrypted.Should().NotBeNullOrEmpty();
        encrypted.Should().NotBe(plaintext);
        decrypted.Should().Be(plaintext);
    }

    [Fact]
    public void Encrypt_ShouldReturnInput_WhenNullOrEmpty()
    {
        // Arrange
        var service = CreateService();

        // Act
        string? encryptedNull = service.Encrypt(null!);
        var encryptedEmpty = service.Encrypt(string.Empty);

        // Assert
        encryptedNull.Should().BeNull();
        encryptedEmpty.Should().Be(string.Empty);
    }

    [Fact]
    public void Decrypt_ShouldReturnInput_WhenValueIsNotEncrypted()
    {
        // Arrange
        var service = CreateService();
        const string plaintext = "already-plain-text";

        // Act
        var result = service.Decrypt(plaintext);

        // Assert
        result.Should().Be(plaintext);
    }

    [Fact]
    public void Decrypt_ShouldReturnInput_WhenNullOrEmpty()
    {
        // Arrange
        var service = CreateService();

        // Act
        string? decryptedNull = service.Decrypt(null!);
        var decryptedEmpty = service.Decrypt(string.Empty);

        // Assert
        decryptedNull.Should().BeNull();
        decryptedEmpty.Should().Be(string.Empty);
    }

    [Fact]
    public void IsEncrypted_ShouldReturnTrue_ForValueEncryptedByService()
    {
        // Arrange
        var service = CreateService();

        // Act
        var encrypted = service.Encrypt("sensitive-value");
        var isEncrypted = service.IsEncrypted(encrypted);

        // Assert
        isEncrypted.Should().BeTrue();
    }

    [Fact]
    public void IsEncrypted_ShouldReturnFalse_ForPlaintext()
    {
        // Arrange
        var service = CreateService();

        // Act
        var isEncrypted = service.IsEncrypted("plain-text");

        // Assert
        isEncrypted.Should().BeFalse();
    }

    [Fact]
    public void Decrypt_ShouldThrow_WhenCiphertextLooksEncryptedButCannotBeDecrypted()
    {
        // Arrange
        var service = CreateService();
        var invalidCiphertext = Convert.ToBase64String(new byte[64]);

        // Act
        var act = () => service.Decrypt(invalidCiphertext);

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("Failed to decrypt sensitive data");
    }

    private static EncryptionService CreateService()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            ["EncryptionKey"] = "test-key-for-unit-tests-only"
        };

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        var logger = Mock.Of<ILogger<EncryptionService>>();

        return new EncryptionService(configuration, logger);
    }
}

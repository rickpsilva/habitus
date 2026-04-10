namespace Habitus.Application.Interfaces;

/// <summary>
/// Provides encryption and decryption services for sensitive data.
/// Implementation details may vary - use this interface for abstraction.
/// </summary>
public interface IEncryptionService
{
    /// <summary>
    /// Encrypts plaintext data.
    /// </summary>
    string Encrypt(string plaintext);

    /// <summary>
    /// Decrypts ciphertext data.
    /// </summary>
    string Decrypt(string ciphertext);

    /// <summary>
    /// Checks if a string appears to be encrypted.
    /// Used for backward compatibility during data migrations.
    /// </summary>
    bool IsEncrypted(string value);
}

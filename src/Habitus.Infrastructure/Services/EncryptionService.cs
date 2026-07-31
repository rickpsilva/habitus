using System;
using System.Security.Cryptography;
using System.Text;
using Habitus.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Provides encryption and decryption services for sensitive data.
/// Uses AES-256-GCM for authenticated encryption.
/// </summary>
public class EncryptionService : IEncryptionService
{
    private readonly byte[] _encryptionKey;
    private readonly ILogger<EncryptionService> _logger;
    private const int KeySize = 32; // 256 bits
    private const int NonceSize = 12; // 96 bits for GCM
    private const int TagSize = 16; // 128 bits for GCM
    private const string DevelopmentKey = "habitus-default-encryption-key-for-development-only";
    private const string DefaultSalt = "habitus-encryption-salt";

    public EncryptionService(IConfiguration configuration, ILogger<EncryptionService> logger, bool isDevelopment = false)
    {
        _logger = logger;
        
        // Prefer configuration (appsettings.*) and keep env var fallback for cloud deployments.
        var keyString = configuration["EncryptionKey"]
            ?? Environment.GetEnvironmentVariable("ENCRYPTION_KEY");
        
        if (string.IsNullOrEmpty(keyString) || keyString == DevelopmentKey)
        {
            // Outside Development, refuse to start rather than silently protecting PII with the
            // well-known development key.
            if (!isDevelopment)
            {
                throw new InvalidOperationException(
                    "EncryptionKey is not configured (or is set to the development default) in a non-Development " +
                    "environment. Configure a strong EncryptionKey (e.g. via Azure Key Vault) before starting.");
            }

            _logger.LogWarning("EncryptionKey not configured. Using development key. DO NOT USE IN PRODUCTION!");
            keyString = DevelopmentKey;
        }

        // Salt is configurable per deployment; overriding EncryptionSalt requires re-encrypting existing data.
        var salt = configuration["EncryptionSalt"];
        if (string.IsNullOrEmpty(salt))
            salt = DefaultSalt;

        // Derive a 256-bit key from the provided string using PBKDF2
        _encryptionKey = DeriveKeyFromString(keyString, salt);
    }

    public string Encrypt(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext))
            return plaintext;

        try
        {
            using (var aes = new AesGcm(_encryptionKey, TagSize))
            {
                var nonce = new byte[NonceSize];
                using (var rng = RandomNumberGenerator.Create())
                {
                    rng.GetBytes(nonce);
                }

                var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
                var ciphertextBytes = new byte[plaintextBytes.Length];
                var tag = new byte[TagSize];

                aes.Encrypt(nonce, plaintextBytes, ciphertextBytes, tag);

                // Combine nonce + ciphertext + tag and return as base64
                var result = new byte[NonceSize + ciphertextBytes.Length + TagSize];
                Buffer.BlockCopy(nonce, 0, result, 0, NonceSize);
                Buffer.BlockCopy(ciphertextBytes, 0, result, NonceSize, ciphertextBytes.Length);
                Buffer.BlockCopy(tag, 0, result, NonceSize + ciphertextBytes.Length, TagSize);

                return Convert.ToBase64String(result);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error encrypting data");
            throw new InvalidOperationException("Failed to encrypt sensitive data", ex);
        }
    }

    public string Decrypt(string ciphertext)
    {
        if (string.IsNullOrEmpty(ciphertext))
            return ciphertext;

        // If it doesn't look encrypted (doesn't start with valid base64), return as-is
        if (!IsEncrypted(ciphertext))
            return ciphertext;

        try
        {
            var encryptedData = Convert.FromBase64String(ciphertext);
            
            if (encryptedData.Length < NonceSize + TagSize)
                throw new InvalidOperationException("Invalid encrypted data format");

            using (var aes = new AesGcm(_encryptionKey, TagSize))
            {
                var nonce = new byte[NonceSize];
                var ciphertextBytes = new byte[encryptedData.Length - NonceSize - TagSize];
                var tag = new byte[TagSize];

                Buffer.BlockCopy(encryptedData, 0, nonce, 0, NonceSize);
                Buffer.BlockCopy(encryptedData, NonceSize, ciphertextBytes, 0, ciphertextBytes.Length);
                Buffer.BlockCopy(encryptedData, NonceSize + ciphertextBytes.Length, tag, 0, TagSize);

                var plaintextBytes = new byte[ciphertextBytes.Length];
                aes.Decrypt(nonce, ciphertextBytes, tag, plaintextBytes);

                return Encoding.UTF8.GetString(plaintextBytes);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error decrypting data");
            throw new InvalidOperationException("Failed to decrypt sensitive data", ex);
        }
    }

    public bool IsEncrypted(string value)
    {
        if (string.IsNullOrEmpty(value))
            return false;

        // Check if it looks like valid base64 and is long enough to contain nonce + tag
        try
        {
            var decoded = Convert.FromBase64String(value);
            return decoded.Length >= NonceSize + TagSize;
        }
        catch
        {
            return false;
        }
    }

    private static byte[] DeriveKeyFromString(string keyString, string salt)
    {
        // Use PBKDF2 to derive a 256-bit key from the input string
        var saltBytes = Encoding.UTF8.GetBytes(salt);
        
        return Rfc2898DeriveBytes.Pbkdf2(keyString, saltBytes, 100000, HashAlgorithmName.SHA256, KeySize);
    }
}

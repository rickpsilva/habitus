using System.Security.Cryptography;
using System.Text;

namespace Habitus.Application.Helpers;

/// <summary>
/// Helper for generating deterministic SHA256 hashes for email addresses.
/// Used for unique indexing and fast lookups without exposing plaintext email in queries.
/// </summary>
public static class EmailHashHelper
{
    /// <summary>
    /// Generate SHA256 hash of email for unique index and fast login.
    /// Hashes the lowercase email to ensure consistency regardless of case.
    /// </summary>
    public static string GenerateEmailHash(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return string.Empty;

        var emailLower = email.ToLowerInvariant();
        using (var sha256 = SHA256.Create())
        {
            var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(emailLower));
            return Convert.ToHexString(hashedBytes);
        }
    }
}

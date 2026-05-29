using System.Security.Cryptography;
using System.Text;

namespace Habitus.Application.Helpers;

public static class EmailHashHelper
{
    public static string Normalize(string email)
    {
        return string.IsNullOrWhiteSpace(email)
            ? string.Empty
            : email.Trim().ToLowerInvariant();
    }

    public static string GenerateEmailHash(string email)
    {
        var normalized = Normalize(email);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexString(bytes);
    }
}

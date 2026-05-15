using Microsoft.Extensions.Configuration;

namespace Habitus.Application.Helpers;

public static class RgpdRuntimePolicy
{
    public const string AllowLegacyPlaintextFallbackConfigKey = "Rgpd:AllowLegacyPlaintextFallback";
    public const string AllowLegacyPlaintextFallbackEnvVar = "RGPD_ALLOW_LEGACY_PLAINTEXT_FALLBACK";

    public static bool AllowLegacyPlaintextFallback(IConfiguration? configuration = null)
    {
        var configuredRawValue = configuration?[AllowLegacyPlaintextFallbackConfigKey];
        if (bool.TryParse(configuredRawValue, out var configuredValue))
        {
            return configuredValue;
        }

        var envValue = Environment.GetEnvironmentVariable(AllowLegacyPlaintextFallbackEnvVar);
        if (bool.TryParse(envValue, out var parsed))
        {
            return parsed;
        }

        return true;
    }
}

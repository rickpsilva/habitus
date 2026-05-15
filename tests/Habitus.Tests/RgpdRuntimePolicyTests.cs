using FluentAssertions;
using Habitus.Application.Helpers;
using Microsoft.Extensions.Configuration;

namespace Habitus.Tests;

public class RgpdRuntimePolicyTests
{
    [Fact]
    public void AllowLegacyPlaintextFallback_ShouldUseConfigValue_WhenProvided()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [RgpdRuntimePolicy.AllowLegacyPlaintextFallbackConfigKey] = "false"
            })
            .Build();

        var result = RgpdRuntimePolicy.AllowLegacyPlaintextFallback(configuration);

        result.Should().BeFalse();
    }

    [Fact]
    public void AllowLegacyPlaintextFallback_ShouldUseEnvVar_WhenConfigMissing()
    {
        var previous = Environment.GetEnvironmentVariable(RgpdRuntimePolicy.AllowLegacyPlaintextFallbackEnvVar);

        try
        {
            Environment.SetEnvironmentVariable(RgpdRuntimePolicy.AllowLegacyPlaintextFallbackEnvVar, "false");

            var result = RgpdRuntimePolicy.AllowLegacyPlaintextFallback();

            result.Should().BeFalse();
        }
        finally
        {
            Environment.SetEnvironmentVariable(RgpdRuntimePolicy.AllowLegacyPlaintextFallbackEnvVar, previous);
        }
    }

    [Fact]
    public void AllowLegacyPlaintextFallback_ShouldDefaultTrue_WhenNothingConfigured()
    {
        var previous = Environment.GetEnvironmentVariable(RgpdRuntimePolicy.AllowLegacyPlaintextFallbackEnvVar);

        try
        {
            Environment.SetEnvironmentVariable(RgpdRuntimePolicy.AllowLegacyPlaintextFallbackEnvVar, null);

            var result = RgpdRuntimePolicy.AllowLegacyPlaintextFallback();

            result.Should().BeTrue();
        }
        finally
        {
            Environment.SetEnvironmentVariable(RgpdRuntimePolicy.AllowLegacyPlaintextFallbackEnvVar, previous);
        }
    }
}

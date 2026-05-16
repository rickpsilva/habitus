using Habitus.Application.Helpers;
using Habitus.Application.Attributes;
using FluentAssertions;

namespace Habitus.Tests;

public class SensitiveDataMaskingTests
{
    private sealed class TestDto
    {
        [SensitiveData(SensitiveDataType.Email, RequiresRole = "Manager,Admin")]
        public string Email { get; set; } = string.Empty;

        [SensitiveData(SensitiveDataType.Phone, RequiresRole = "Manager")]
        public string Phone { get; set; } = string.Empty;

        [SensitiveData(SensitiveDataType.Generic)]
        public string Secret { get; set; } = string.Empty;
    }

    [Fact]
    public void MaskEmail_ShouldMaskLocalPart_AndKeepDomain()
    {
        var result = DataMaskingHelper.MaskEmail("joao.silva@example.com");

        result.Should().Be("j***@example.com");
    }

    [Fact]
    public void MaskEmail_ShouldReturnPlaceholder_ForInvalidEmail()
    {
        var result = DataMaskingHelper.MaskEmail("invalid-email");

        result.Should().Be("****");
    }

    [Fact]
    public void MaskPhone_ShouldKeepOnlyLastTwoDigits()
    {
        var result = DataMaskingHelper.MaskPhone("912345678");

        result.Should().Be("*******78");
    }

    [Fact]
    public void MaskTaxId_ShouldKeepOnlyLastFourDigits()
    {
        var result = DataMaskingHelper.MaskTaxId("123456789");

        result.Should().Be("*****6789");
    }

    [Fact]
    public void MaskIban_ShouldKeepPrefixAndLastFourCharacters()
    {
        var iban = "PT50 0002 0123 1234 5678 9015 4";

        var result = DataMaskingHelper.MaskIban(iban);

        result.Should().StartWith("PT50");
        result.Should().EndWith("015 4");
        result.Should().Contain("*");
    }

    [Fact]
    public void MaskHelpers_ShouldReturnOriginal_WhenNullOrEmpty()
    {
        DataMaskingHelper.MaskPhone(null).Should().BeNull();
        DataMaskingHelper.MaskPhone(string.Empty).Should().BeEmpty();
        DataMaskingHelper.MaskTaxId(null).Should().BeNull();
        DataMaskingHelper.MaskTaxId(string.Empty).Should().BeEmpty();
        DataMaskingHelper.MaskIban(null).Should().BeNull();
        DataMaskingHelper.MaskIban(string.Empty).Should().BeEmpty();
    }

    [Fact]
    public void ApplySensitiveDataMasking_ShouldMask_WhenRoleNotAllowed()
    {
        var dto = new TestDto
        {
            Email = "joao.silva@example.com",
            Phone = "912345678",
            Secret = "my-secret"
        };

        DataMaskingHelper.ApplySensitiveDataMasking(dto, "Resident");

        dto.Email.Should().Be("j***@example.com");
        dto.Phone.Should().Be("*******78");
        dto.Secret.Should().Be("****");
    }

    [Fact]
    public void ApplySensitiveDataMasking_ShouldKeepRaw_WhenRoleAllowed()
    {
        var dto = new TestDto
        {
            Email = "joao.silva@example.com",
            Phone = "912345678",
            Secret = "my-secret"
        };

        DataMaskingHelper.ApplySensitiveDataMasking(dto, "Manager");

        dto.Email.Should().Be("joao.silva@example.com");
        dto.Phone.Should().Be("912345678");
        dto.Secret.Should().Be("****");
    }
}

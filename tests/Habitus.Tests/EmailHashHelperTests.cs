using Habitus.Application.Helpers;
using FluentAssertions;

namespace Habitus.Tests;

public class EmailHashHelperTests
{
    [Fact]
    public void GenerateEmailHash_WithEmail_ShouldReturnSHA256Hash()
    {
        var email = "user@example.com";
        var hash = EmailHashHelper.GenerateEmailHash(email);

        hash.Should().NotBeNullOrEmpty();
        hash.Length.Should().Be(64);  // SHA256 hex string is 64 characters
    }

    [Fact]
    public void GenerateEmailHash_WithDifferentEmails_ShouldReturnDifferentHashes()
    {
        var email1 = "user1@example.com";
        var email2 = "user2@example.com";
        
        var hash1 = EmailHashHelper.GenerateEmailHash(email1);
        var hash2 = EmailHashHelper.GenerateEmailHash(email2);

        hash1.Should().NotBe(hash2);
    }

    [Fact]
    public void GenerateEmailHash_WithSameEmail_ShouldReturnConsistentHash()
    {
        var email = "user@example.com";
        
        var hash1 = EmailHashHelper.GenerateEmailHash(email);
        var hash2 = EmailHashHelper.GenerateEmailHash(email);

        hash1.Should().Be(hash2);
    }

    [Fact]
    public void GenerateEmailHash_IsCaseInsensitive()
    {
        var emailLower = "user@example.com";
        var emailUpper = "USER@EXAMPLE.COM";
        var emailMixed = "User@Example.Com";
        
        var hashLower = EmailHashHelper.GenerateEmailHash(emailLower);
        var hashUpper = EmailHashHelper.GenerateEmailHash(emailUpper);
        var hashMixed = EmailHashHelper.GenerateEmailHash(emailMixed);

        hashLower.Should().Be(hashUpper);
        hashLower.Should().Be(hashMixed);
    }

    [Fact]
    public void GenerateEmailHash_WithEmptyEmail_ShouldReturnEmpty()
    {
        var hash = EmailHashHelper.GenerateEmailHash(string.Empty);
        
        hash.Should().Be(string.Empty);
    }

    [Fact]
    public void GenerateEmailHash_WithNullEmail_ShouldNotThrow()
    {
        // Nota: whitespace é considerado null por IsNullOrWhiteSpace
        var act = () => EmailHashHelper.GenerateEmailHash("   ");
        
        act.Should().NotThrow();
    }
}

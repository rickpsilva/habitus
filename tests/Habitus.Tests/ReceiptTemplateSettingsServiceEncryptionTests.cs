using System;
using System.Threading.Tasks;
using FluentAssertions;
using Habitus.Application.DTOs.Receipts;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;
using Xunit;

namespace Habitus.Tests
{
    public class ReceiptTemplateSettingsServiceEncryptionTests
    {
        [Fact]
        public async Task UpsertAsync_ShouldEncryptAndDecryptSensitiveFields()
        {
            // Arrange
            var repo = new Mock<IRepository<ReceiptTemplateSettings>>();
            repo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ReceiptTemplateSettings, bool>>>()))
                .ReturnsAsync(new System.Collections.Generic.List<ReceiptTemplateSettings>());
            repo.Setup(r => r.AddAsync(It.IsAny<ReceiptTemplateSettings>())).Returns(Task.CompletedTask);
            repo.Setup(r => r.Update(It.IsAny<ReceiptTemplateSettings>()));
            repo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

            var encryption = new Mock<IEncryptionService>();
            encryption.Setup(e => e.Encrypt(It.IsAny<string>())).Returns((string s) => $"enc:{s}");
            encryption.Setup(e => e.Decrypt(It.IsAny<string>())).Returns((string s) => s.StartsWith("enc:") ? s.Substring(4) : s);

            var service = new ReceiptTemplateSettingsService(repo.Object, encryption.Object);
            var request = new UpdateReceiptTemplateSettingsRequest
            {
                Address = "Rua Teste",
                PostalCode = "1234-567",
                Locality = "Lisboa",
                TaxId = "999999990",
                Email = "test@email.com",
                Phone = "912345678"
            };

            // Act
            var dto = await service.UpsertAsync(Guid.NewGuid(), request);

            // Assert
            dto.Address.Should().Be("Rua Teste");
            dto.PostalCode.Should().Be("1234-567");
            dto.Locality.Should().Be("Lisboa");
            dto.TaxId.Should().Be("999999990");
            dto.Email.Should().Be("test@email.com");
            dto.Phone.Should().Be("912345678");
        }

        [Fact]
        public async Task GetByCondominiumIdAsync_ShouldDecryptEncryptedFieldsOrFallbackToLegacy()
        {
            // Arrange
            var encrypted = "enc:Rua Nova";
            var repo = new Mock<IRepository<ReceiptTemplateSettings>>();
            repo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ReceiptTemplateSettings, bool>>>()))
                .ReturnsAsync(new System.Collections.Generic.List<ReceiptTemplateSettings> {
                    new ReceiptTemplateSettings {
                        Id = Guid.NewGuid(),
                        CondominiumId = Guid.NewGuid(),
                        AddressEncrypted = encrypted,
                        Address = "LEGACY",
                        PostalCodeEncrypted = null,
                        PostalCode = "LEGACYPC"
                    }
                });
            var encryption = new Mock<IEncryptionService>();
            encryption.Setup(e => e.Decrypt(It.IsAny<string>())).Returns((string s) => s.StartsWith("enc:") ? s.Substring(4) : s);

            var service = new ReceiptTemplateSettingsService(repo.Object, encryption.Object);

            // Act
            var dto = await service.GetByCondominiumIdAsync(Guid.NewGuid());

            // Assert
            dto.Address.Should().Be("Rua Nova"); // decrypted
            dto.PostalCode.Should().Be("LEGACYPC"); // fallback
        }
    }
}

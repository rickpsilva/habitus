using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEncryptionFieldsForSensitiveData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankTransferIbanEncrypted",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CardSecretKeyEncrypted",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentIbanEncrypted",
                table: "Condominiums",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaxIdEncrypted",
                table: "Condominiums",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankTransferIbanEncrypted",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "CardSecretKeyEncrypted",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "PaymentIbanEncrypted",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "TaxIdEncrypted",
                table: "Condominiums");
        }
    }
}

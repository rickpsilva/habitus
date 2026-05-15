using Microsoft.EntityFrameworkCore.Migrations;

namespace Habitus.Infrastructure.Migrations
{
    public partial class AddReceiptTemplateSettingsEncryptedFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AddressEncrypted",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "PostalCodeEncrypted",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "LocalityEncrypted",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "TaxIdEncrypted",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "EmailEncrypted",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "PhoneEncrypted",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AddressEncrypted",
                table: "ReceiptTemplateSettings");
            migrationBuilder.DropColumn(
                name: "PostalCodeEncrypted",
                table: "ReceiptTemplateSettings");
            migrationBuilder.DropColumn(
                name: "LocalityEncrypted",
                table: "ReceiptTemplateSettings");
            migrationBuilder.DropColumn(
                name: "TaxIdEncrypted",
                table: "ReceiptTemplateSettings");
            migrationBuilder.DropColumn(
                name: "EmailEncrypted",
                table: "ReceiptTemplateSettings");
            migrationBuilder.DropColumn(
                name: "PhoneEncrypted",
                table: "ReceiptTemplateSettings");
        }
    }
}

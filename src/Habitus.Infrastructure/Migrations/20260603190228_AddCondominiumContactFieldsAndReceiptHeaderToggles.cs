using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCondominiumContactFieldsAndReceiptHeaderToggles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IncludeAddress",
                table: "ReceiptTemplateSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IncludeCondominiumName",
                table: "ReceiptTemplateSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IncludeContactPhone",
                table: "ReceiptTemplateSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IncludeEmail",
                table: "ReceiptTemplateSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IncludeLocality",
                table: "ReceiptTemplateSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IncludePostalCode",
                table: "ReceiptTemplateSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IncludeTaxId",
                table: "ReceiptTemplateSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactPhoneEncrypted",
                table: "Condominiums",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LocalityEncrypted",
                table: "Condominiums",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PostalCodeEncrypted",
                table: "Condominiums",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IncludeAddress",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "IncludeCondominiumName",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "IncludeContactPhone",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "IncludeEmail",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "IncludeLocality",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "IncludePostalCode",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "IncludeTaxId",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "ContactPhoneEncrypted",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "LocalityEncrypted",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PostalCodeEncrypted",
                table: "Condominiums");
        }
    }
}

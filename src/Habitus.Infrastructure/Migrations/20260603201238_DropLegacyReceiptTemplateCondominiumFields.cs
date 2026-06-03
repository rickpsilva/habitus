using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropLegacyReceiptTemplateCondominiumFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Address",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "CompanyName",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "Locality",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "PostalCode",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "TaxId",
                table: "ReceiptTemplateSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompanyName",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Locality",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PostalCode",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaxId",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddReceiptTemplatePeriodsAndLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Locality",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PostalCode",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateMonthlyFeeAnnual",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateMonthlyFeeQuarterly",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Locality",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "PostalCode",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "TemplateMonthlyFeeAnnual",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "TemplateMonthlyFeeQuarterly",
                table: "ReceiptTemplateSettings");
        }
    }
}

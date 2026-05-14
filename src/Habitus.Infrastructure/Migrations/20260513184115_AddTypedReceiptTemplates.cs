using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTypedReceiptTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TemplateExtraordinaryFee",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateMonthlyFee",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateOther",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateReservation",
                table: "ReceiptTemplateSettings",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("UPDATE \"ReceiptTemplateSettings\" SET \"TemplateMonthlyFee\" = COALESCE(\"TemplateMonthlyFee\", \"Template\"), \"TemplateExtraordinaryFee\" = COALESCE(\"TemplateExtraordinaryFee\", \"Template\"), \"TemplateReservation\" = COALESCE(\"TemplateReservation\", \"Template\"), \"TemplateOther\" = COALESCE(\"TemplateOther\", \"Template\") WHERE \"Template\" IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TemplateExtraordinaryFee",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "TemplateMonthlyFee",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "TemplateOther",
                table: "ReceiptTemplateSettings");

            migrationBuilder.DropColumn(
                name: "TemplateReservation",
                table: "ReceiptTemplateSettings");
        }
    }
}

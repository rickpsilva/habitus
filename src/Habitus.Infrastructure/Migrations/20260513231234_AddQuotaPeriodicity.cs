using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuotaPeriodicity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "QuotaMonthEnd",
                table: "Payments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuotaMonthStart",
                table: "Payments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuotaPeriodicity",
                table: "Payments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuotaYear",
                table: "Payments",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QuotaMonthEnd",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "QuotaMonthStart",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "QuotaPeriodicity",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "QuotaYear",
                table: "Payments");
        }
    }
}

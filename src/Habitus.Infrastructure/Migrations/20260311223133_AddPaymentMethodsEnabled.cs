using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentMethodsEnabled : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PaymentBankTransferEnabled",
                table: "Condominiums",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PaymentCardEnabled",
                table: "Condominiums",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PaymentMbWayEnabled",
                table: "Condominiums",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentBankTransferEnabled",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PaymentCardEnabled",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PaymentMbWayEnabled",
                table: "Condominiums");
        }
    }
}

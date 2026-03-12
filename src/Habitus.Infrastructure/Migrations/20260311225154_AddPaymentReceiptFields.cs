using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentReceiptFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReceiptIssuedByUserId",
                table: "Payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReceiptIssuedDate",
                table: "Payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReceiptNumber",
                table: "Payments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiptPdfPath",
                table: "Payments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReceiptYear",
                table: "Payments",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_ReceiptIssuedByUserId",
                table: "Payments",
                column: "ReceiptIssuedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Users_ReceiptIssuedByUserId",
                table: "Payments",
                column: "ReceiptIssuedByUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Users_ReceiptIssuedByUserId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_ReceiptIssuedByUserId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReceiptIssuedByUserId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReceiptIssuedDate",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReceiptNumber",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReceiptPdfPath",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReceiptYear",
                table: "Payments");
        }
    }
}

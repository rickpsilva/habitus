using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PaymentSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    BankTransferEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    BankTransferIban = table.Column<string>(type: "text", nullable: true),
                    BankTransferAccountHolder = table.Column<string>(type: "text", nullable: true),
                    MBReferenceEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    MBReferenceEntity = table.Column<string>(type: "text", nullable: true),
                    MBReferenceReference = table.Column<string>(type: "text", nullable: true),
                    MBWayEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    MBWayPhoneNumber = table.Column<string>(type: "text", nullable: true),
                    MBWayMerchantId = table.Column<string>(type: "text", nullable: true),
                    CardEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CardProvider = table.Column<string>(type: "text", nullable: true),
                    CardPublicKey = table.Column<string>(type: "text", nullable: true),
                    CardSecretKey = table.Column<string>(type: "text", nullable: true),
                    CardMerchantId = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PaymentSettings_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentSettings_CondominiumId",
                table: "PaymentSettings",
                column: "CondominiumId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentSettings");
        }
    }
}

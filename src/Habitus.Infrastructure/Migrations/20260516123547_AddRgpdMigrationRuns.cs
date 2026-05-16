using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRgpdMigrationRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RgpdMigrationRuns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OperationType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TriggeredByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CondominiumRecordsUpdated = table.Column<int>(type: "integer", nullable: false),
                    InvoiceRecordsUpdated = table.Column<int>(type: "integer", nullable: false),
                    ValuesEncrypted = table.Column<int>(type: "integer", nullable: false),
                    LegacyValuesCleared = table.Column<int>(type: "integer", nullable: false),
                    RemainingCondominiumTaxIdLegacyCount = table.Column<int>(type: "integer", nullable: false),
                    RemainingCondominiumPaymentIbanLegacyCount = table.Column<int>(type: "integer", nullable: false),
                    RemainingCondominiumAddressLegacyCount = table.Column<int>(type: "integer", nullable: false),
                    RemainingInvoiceCustomerTaxIdLegacyCount = table.Column<int>(type: "integer", nullable: false),
                    RemainingInvoiceCustomerAddressLegacyCount = table.Column<int>(type: "integer", nullable: false),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RgpdMigrationRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RgpdMigrationRuns_Users_TriggeredByUserId",
                        column: x => x.TriggeredByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RgpdMigrationRuns_StartedAt",
                table: "RgpdMigrationRuns",
                column: "StartedAt");

            migrationBuilder.CreateIndex(
                name: "IX_RgpdMigrationRuns_Status",
                table: "RgpdMigrationRuns",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_RgpdMigrationRuns_TriggeredByUserId",
                table: "RgpdMigrationRuns",
                column: "TriggeredByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RgpdMigrationRuns");
        }
    }
}

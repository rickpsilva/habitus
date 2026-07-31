using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_CondominiumId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_CondominiumId",
                table: "MaintenanceRequests");

            migrationBuilder.DropIndex(
                name: "IX_Announcements_CondominiumId",
                table: "Announcements");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_CondominiumId_ResidentId_CreatedDate",
                table: "Payments",
                columns: new[] { "CondominiumId", "ResidentId", "CreatedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_CondominiumId_Status",
                table: "Payments",
                columns: new[] { "CondominiumId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_CondominiumId_CreatedAt",
                table: "MaintenanceRequests",
                columns: new[] { "CondominiumId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_CondominiumId_Status_IsPinned_PublishedAt",
                table: "Announcements",
                columns: new[] { "CondominiumId", "Status", "IsPinned", "PublishedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_CondominiumId_ResidentId_CreatedDate",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_CondominiumId_Status",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_CondominiumId_CreatedAt",
                table: "MaintenanceRequests");

            migrationBuilder.DropIndex(
                name: "IX_Announcements_CondominiumId_Status_IsPinned_PublishedAt",
                table: "Announcements");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_CondominiumId",
                table: "Payments",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_CondominiumId",
                table: "MaintenanceRequests",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_CondominiumId",
                table: "Announcements",
                column: "CondominiumId");
        }
    }
}

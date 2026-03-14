using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCondominiumIdToMaintenanceAndReservation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ResidentId",
                table: "Reservations",
                newName: "UserId");

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "Reservations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "SharedSpaceId",
                table: "Reservations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "MaintenanceRequests",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Migrate existing MaintenanceRequests - populate CondominiumId from Unit
            migrationBuilder.Sql(@"
                UPDATE ""MaintenanceRequests"" mr
                SET ""CondominiumId"" = u.""CondominiumId""
                FROM ""Units"" u
                WHERE mr.""UnitId"" = u.""Id"";
            ");

            // Migrate existing Reservations - populate CondominiumId from SharedSpace
            migrationBuilder.Sql(@"
                UPDATE ""Reservations"" r
                SET ""CondominiumId"" = s.""CondominiumId""
                FROM ""SharedSpaces"" s
                WHERE r.""SpaceId"" = s.""Id"";
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_CondominiumId",
                table: "Reservations",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_SharedSpaceId",
                table: "Reservations",
                column: "SharedSpaceId");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_UserId",
                table: "Reservations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_CondominiumId",
                table: "MaintenanceRequests",
                column: "CondominiumId");

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceRequests_Condominiums_CondominiumId",
                table: "MaintenanceRequests",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Reservations_Condominiums_CondominiumId",
                table: "Reservations",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Reservations_SharedSpaces_SharedSpaceId",
                table: "Reservations",
                column: "SharedSpaceId",
                principalTable: "SharedSpaces",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Reservations_Users_UserId",
                table: "Reservations",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceRequests_Condominiums_CondominiumId",
                table: "MaintenanceRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_Reservations_Condominiums_CondominiumId",
                table: "Reservations");

            migrationBuilder.DropForeignKey(
                name: "FK_Reservations_SharedSpaces_SharedSpaceId",
                table: "Reservations");

            migrationBuilder.DropForeignKey(
                name: "FK_Reservations_Users_UserId",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_CondominiumId",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_SharedSpaceId",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_UserId",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_CondominiumId",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "SharedSpaceId",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "MaintenanceRequests");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "Reservations",
                newName: "ResidentId");
        }
    }
}

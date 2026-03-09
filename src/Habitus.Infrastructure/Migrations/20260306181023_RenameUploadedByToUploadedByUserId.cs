using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameUploadedByToUploadedByUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Documents_Assemblies_AssemblyId",
                table: "Documents");

            migrationBuilder.DropForeignKey(
                name: "FK_Documents_MaintenanceRequests_MaintenanceRequestId",
                table: "Documents");

            migrationBuilder.DropForeignKey(
                name: "FK_Documents_Units_UnitId",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "UploadedBy",
                table: "Documents");

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_Assemblies_AssemblyId",
                table: "Documents",
                column: "AssemblyId",
                principalTable: "Assemblies",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_MaintenanceRequests_MaintenanceRequestId",
                table: "Documents",
                column: "MaintenanceRequestId",
                principalTable: "MaintenanceRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_Units_UnitId",
                table: "Documents",
                column: "UnitId",
                principalTable: "Units",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Documents_Assemblies_AssemblyId",
                table: "Documents");

            migrationBuilder.DropForeignKey(
                name: "FK_Documents_MaintenanceRequests_MaintenanceRequestId",
                table: "Documents");

            migrationBuilder.DropForeignKey(
                name: "FK_Documents_Units_UnitId",
                table: "Documents");

            migrationBuilder.AddColumn<Guid>(
                name: "UploadedBy",
                table: "Documents",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_Assemblies_AssemblyId",
                table: "Documents",
                column: "AssemblyId",
                principalTable: "Assemblies",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_MaintenanceRequests_MaintenanceRequestId",
                table: "Documents",
                column: "MaintenanceRequestId",
                principalTable: "MaintenanceRequests",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_Units_UnitId",
                table: "Documents",
                column: "UnitId",
                principalTable: "Units",
                principalColumn: "Id");
        }
    }
}

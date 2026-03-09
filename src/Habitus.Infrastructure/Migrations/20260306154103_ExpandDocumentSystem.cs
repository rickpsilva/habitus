using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ExpandDocumentSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Url",
                table: "Documents",
                newName: "MimeType");

            migrationBuilder.AddColumn<Guid>(
                name: "AssemblyId",
                table: "Documents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Context",
                table: "Documents",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Documents",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FilePath",
                table: "Documents",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "FileSize",
                table: "Documents",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<Guid>(
                name: "MaintenanceRequestId",
                table: "Documents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UnitId",
                table: "Documents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UploadedByUserId",
                table: "Documents",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_Documents_AssemblyId",
                table: "Documents",
                column: "AssemblyId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_MaintenanceRequestId",
                table: "Documents",
                column: "MaintenanceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_UnitId",
                table: "Documents",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_UploadedByUserId",
                table: "Documents",
                column: "UploadedByUserId");

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

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_Users_UploadedByUserId",
                table: "Documents",
                column: "UploadedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
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

            migrationBuilder.DropForeignKey(
                name: "FK_Documents_Users_UploadedByUserId",
                table: "Documents");

            migrationBuilder.DropIndex(
                name: "IX_Documents_AssemblyId",
                table: "Documents");

            migrationBuilder.DropIndex(
                name: "IX_Documents_MaintenanceRequestId",
                table: "Documents");

            migrationBuilder.DropIndex(
                name: "IX_Documents_UnitId",
                table: "Documents");

            migrationBuilder.DropIndex(
                name: "IX_Documents_UploadedByUserId",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "AssemblyId",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "Context",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "FilePath",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "FileSize",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "MaintenanceRequestId",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "UnitId",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "UploadedByUserId",
                table: "Documents");

            migrationBuilder.RenameColumn(
                name: "MimeType",
                table: "Documents",
                newName: "Url");
        }
    }
}

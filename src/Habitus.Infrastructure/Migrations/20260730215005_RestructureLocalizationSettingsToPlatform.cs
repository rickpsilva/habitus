using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RestructureLocalizationSettingsToPlatform : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LocalizationSettings_Condominiums_CondominiumId",
                table: "LocalizationSettings");

            migrationBuilder.DropIndex(
                name: "IX_LocalizationSettings_CondominiumId",
                table: "LocalizationSettings");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "LocalizationSettings");

            migrationBuilder.DropColumn(
                name: "MultilanguageEnabled",
                table: "LocalizationSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "LocalizationSettings",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<bool>(
                name: "MultilanguageEnabled",
                table: "LocalizationSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_LocalizationSettings_CondominiumId",
                table: "LocalizationSettings",
                column: "CondominiumId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_LocalizationSettings_Condominiums_CondominiumId",
                table: "LocalizationSettings",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

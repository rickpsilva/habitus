using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropLegacyCondominiumTaxId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Condominiums_TaxId",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "TaxId",
                table: "Condominiums");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TaxId",
                table: "Condominiums",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Condominiums_TaxId",
                table: "Condominiums",
                column: "TaxId");
        }
    }
}
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSupplierContact : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Contact",
                table: "Suppliers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Contact",
                table: "Suppliers",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedDefaultBuildingAndUnit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Insert default Building
            migrationBuilder.InsertData(
                table: "Buildings",
                columns: new[] { "Id", "Name", "Address", "AdminEmail" },
                values: new object[] { new Guid("00000000-0000-0000-0000-000000000001"), "Default Building", "123 Main Street", "admin@habitus.com" });

            // Insert default Unit
            migrationBuilder.InsertData(
                table: "Units",
                columns: new[] { "Id", "BuildingId", "Number", "Floor", "Type" },
                values: new object[] { new Guid("00000000-0000-0000-0000-000000000001"), new Guid("00000000-0000-0000-0000-000000000001"), "101", 1, 0 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Delete default Unit
            migrationBuilder.DeleteData(
                table: "Units",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"));

            // Delete default Building
            migrationBuilder.DeleteData(
                table: "Buildings",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"));
        }
    }
}

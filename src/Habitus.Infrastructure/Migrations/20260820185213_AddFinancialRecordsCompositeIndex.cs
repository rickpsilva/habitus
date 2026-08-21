using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancialRecordsCompositeIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_FinancialRecords_CondominiumId_FiscalYear_Type",
                table: "FinancialRecords",
                columns: new[] { "CondominiumId", "FiscalYear", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialRecords_CondominiumId_FiscalYear_Type_Date",
                table: "FinancialRecords",
                columns: new[] { "CondominiumId", "FiscalYear", "Type", "Date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FinancialRecords_CondominiumId_FiscalYear_Type",
                table: "FinancialRecords");

            migrationBuilder.DropIndex(
                name: "IX_FinancialRecords_CondominiumId_FiscalYear_Type_Date",
                table: "FinancialRecords");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddReserveFundAndFiscalYear : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            //  Add FiscalYear column (extract from Date)
            migrationBuilder.AddColumn<int>(
                name: "FiscalYear",
                table: "FinancialRecords",
                type: "integer",
                nullable: false,
                defaultValue: 2026);

            // Update FiscalYear from existing dates
            migrationBuilder.Sql(
                @"UPDATE ""FinancialRecords"" 
                  SET ""FiscalYear"" = EXTRACT(YEAR FROM ""Date"")");

            // Add new Category enum column
            migrationBuilder.AddColumn<int>(
                name: "CategoryNew",
                table: "FinancialRecords",
                type: "integer",
                nullable: false,
                defaultValue: 8); // OtherExpense

            // Migrate old string categories to new enum values
            migrationBuilder.Sql(
                @"UPDATE ""FinancialRecords"" 
                  SET ""CategoryNew"" = CASE 
                    WHEN ""Category"" = 'Maintenance' THEN 4
                    WHEN ""Category"" = 'Insurance' THEN 5
                    WHEN ""Category"" = 'Utilities' THEN 6
                    WHEN ""Category"" = 'Fees' THEN 0
                    WHEN ""Category"" = 'Other' THEN 8
                    ELSE 8
                  END");

            // Drop old Category column
            migrationBuilder.DropColumn(
                name: "Category",
                table: "FinancialRecords");

            // Rename CategoryNew to Category
            migrationBuilder.RenameColumn(
                name: "CategoryNew",
                table: "FinancialRecords",
                newName: "Category");

            // Create ReserveFunds table
            migrationBuilder.CreateTable(
                name: "ReserveFunds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    FiscalYear = table.Column<int>(type: "integer", nullable: false),
                    OpeningBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    Deposits = table.Column<decimal>(type: "numeric", nullable: false),
                    Withdrawals = table.Column<decimal>(type: "numeric", nullable: false),
                    ClosingBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReserveFunds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReserveFunds_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReserveFunds_CondominiumId",
                table: "ReserveFunds",
                column: "CondominiumId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReserveFunds");

            migrationBuilder.DropColumn(
                name: "FiscalYear",
                table: "FinancialRecords");

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "FinancialRecords",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FinancialRecords_CondominiumId",
                table: "FinancialRecords");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "FinancialRecords");

            migrationBuilder.AddColumn<Guid>(
                name: "ExpenseCategoryId",
                table: "MaintenanceRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Amount",
                table: "FinancialRecords",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AddColumn<Guid>(
                name: "ExpenseCategoryId",
                table: "FinancialRecords",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "IncomeCategory",
                table: "FinancialRecords",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReserveFundCategory",
                table: "FinancialRecords",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ExpenseCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Hashtags = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseCategories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExpenseCategories_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_ExpenseCategoryId",
                table: "MaintenanceRequests",
                column: "ExpenseCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialRecords_CondominiumId_FiscalYear",
                table: "FinancialRecords",
                columns: new[] { "CondominiumId", "FiscalYear" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialRecords_CondominiumId_Type",
                table: "FinancialRecords",
                columns: new[] { "CondominiumId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialRecords_ExpenseCategoryId",
                table: "FinancialRecords",
                column: "ExpenseCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseCategories_CondominiumId_IsActive_IsDeleted",
                table: "ExpenseCategories",
                columns: new[] { "CondominiumId", "IsActive", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseCategories_CondominiumId_NormalizedName",
                table: "ExpenseCategories",
                columns: new[] { "CondominiumId", "NormalizedName" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.AddForeignKey(
                name: "FK_FinancialRecords_ExpenseCategories_ExpenseCategoryId",
                table: "FinancialRecords",
                column: "ExpenseCategoryId",
                principalTable: "ExpenseCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceRequests_ExpenseCategories_ExpenseCategoryId",
                table: "MaintenanceRequests",
                column: "ExpenseCategoryId",
                principalTable: "ExpenseCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FinancialRecords_ExpenseCategories_ExpenseCategoryId",
                table: "FinancialRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceRequests_ExpenseCategories_ExpenseCategoryId",
                table: "MaintenanceRequests");

            migrationBuilder.DropTable(
                name: "ExpenseCategories");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_ExpenseCategoryId",
                table: "MaintenanceRequests");

            migrationBuilder.DropIndex(
                name: "IX_FinancialRecords_CondominiumId_FiscalYear",
                table: "FinancialRecords");

            migrationBuilder.DropIndex(
                name: "IX_FinancialRecords_CondominiumId_Type",
                table: "FinancialRecords");

            migrationBuilder.DropIndex(
                name: "IX_FinancialRecords_ExpenseCategoryId",
                table: "FinancialRecords");

            migrationBuilder.DropColumn(
                name: "ExpenseCategoryId",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "ExpenseCategoryId",
                table: "FinancialRecords");

            migrationBuilder.DropColumn(
                name: "IncomeCategory",
                table: "FinancialRecords");

            migrationBuilder.DropColumn(
                name: "ReserveFundCategory",
                table: "FinancialRecords");

            migrationBuilder.AlterColumn<decimal>(
                name: "Amount",
                table: "FinancialRecords",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AddColumn<int>(
                name: "Category",
                table: "FinancialRecords",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_FinancialRecords_CondominiumId",
                table: "FinancialRecords",
                column: "CondominiumId");
        }
    }
}

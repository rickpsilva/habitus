using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuotaPlansAndMonthlyQuota : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyQuota",
                table: "Units",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "QuotaPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    InflationRate = table.Column<decimal>(type: "numeric", nullable: false),
                    ExtraordinaryQuota = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AppliedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuotaPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuotaPlans_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuotaCalculations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuotaPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    BaseMonthlyQuota = table.Column<decimal>(type: "numeric", nullable: false),
                    InflationAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    MonthlyQuota = table.Column<decimal>(type: "numeric", nullable: false),
                    QuarterlyQuota = table.Column<decimal>(type: "numeric", nullable: false),
                    AnnualQuota = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuotaCalculations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuotaCalculations_QuotaPlans_QuotaPlanId",
                        column: x => x.QuotaPlanId,
                        principalTable: "QuotaPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuotaCalculations_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuotaCalculations_QuotaPlanId",
                table: "QuotaCalculations",
                column: "QuotaPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_QuotaCalculations_UnitId",
                table: "QuotaCalculations",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_QuotaPlans_CondominiumId_Year",
                table: "QuotaPlans",
                columns: new[] { "CondominiumId", "Year" });

            migrationBuilder.CreateIndex(
                name: "IX_QuotaPlans_Status",
                table: "QuotaPlans",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuotaCalculations");

            migrationBuilder.DropTable(
                name: "QuotaPlans");

            migrationBuilder.DropColumn(
                name: "MonthlyQuota",
                table: "Units");
        }
    }
}

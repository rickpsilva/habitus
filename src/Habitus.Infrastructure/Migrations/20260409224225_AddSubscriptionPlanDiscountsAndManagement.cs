using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionPlanDiscountsAndManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AnnualDiscountPercent",
                table: "SubscriptionPlans",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "QuinquennialDiscountPercent",
                table: "SubscriptionPlans",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: new Guid("a0b0c001-0000-0000-0000-000000000000"),
                columns: new[] { "AnnualDiscountPercent", "QuinquennialDiscountPercent" },
                values: new object[] { 0m, 0m });

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: new Guid("a0b0c002-0000-0000-0000-000000000000"),
                columns: new[] { "AnnualDiscountPercent", "QuinquennialDiscountPercent" },
                values: new object[] { 17m, 30m });

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: new Guid("a0b0c003-0000-0000-0000-000000000000"),
                columns: new[] { "AnnualDiscountPercent", "QuinquennialDiscountPercent" },
                values: new object[] { 17m, 30m });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnnualDiscountPercent",
                table: "SubscriptionPlans");

            migrationBuilder.DropColumn(
                name: "QuinquennialDiscountPercent",
                table: "SubscriptionPlans");
        }
    }
}

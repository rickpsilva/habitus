using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitMembership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UnitMemberships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnitMemberships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UnitMemberships_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitMemberships_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitMemberships_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UnitMemberships_CondominiumId",
                table: "UnitMemberships",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitMemberships_UnitId",
                table: "UnitMemberships",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitMemberships_UserId_CondominiumId",
                table: "UnitMemberships",
                columns: new[] { "UserId", "CondominiumId" });

            migrationBuilder.CreateIndex(
                name: "IX_UnitMemberships_UserId_CondominiumId_Primary",
                table: "UnitMemberships",
                columns: new[] { "UserId", "CondominiumId" },
                unique: true,
                filter: "\"IsPrimary\" = true");

            migrationBuilder.CreateIndex(
                name: "IX_UnitMemberships_UserId_UnitId",
                table: "UnitMemberships",
                columns: new[] { "UserId", "UnitId" },
                unique: true);

            // Backfill: create one primary membership for every user that already has a
            // resolved unit + condominium, so existing single-fraction users keep working.
            migrationBuilder.Sql(
                "INSERT INTO \"UnitMemberships\" (\"Id\",\"UserId\",\"UnitId\",\"CondominiumId\",\"IsPrimary\",\"CreatedAt\") " +
                "SELECT gen_random_uuid(), u.\"Id\", u.\"UnitId\", u.\"CondominiumId\", true, now() " +
                "FROM \"Users\" u WHERE u.\"UnitId\" IS NOT NULL AND u.\"CondominiumId\" IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UnitMemberships");
        }
    }
}

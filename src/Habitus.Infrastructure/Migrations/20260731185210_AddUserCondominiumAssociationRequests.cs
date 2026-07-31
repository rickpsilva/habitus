using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserCondominiumAssociationRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserCondominiumAssociationRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequesterUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetCondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedRole = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CorrelationId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserCondominiumAssociationRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserCondominiumAssociationRequests_Condominiums_TargetCondo~",
                        column: x => x.TargetCondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserCondominiumAssociationRequests_Users_RequesterUserId",
                        column: x => x.RequesterUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserCondominiumAssociationRequests_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UCAR_Requester_Status_RequestedAt",
                table: "UserCondominiumAssociationRequests",
                columns: new[] { "RequesterUserId", "Status", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UCAR_TargetCondominium_Status_RequestedAt",
                table: "UserCondominiumAssociationRequests",
                columns: new[] { "TargetCondominiumId", "Status", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UCAR_UniquePendingRequesterTargetRole",
                table: "UserCondominiumAssociationRequests",
                columns: new[] { "RequesterUserId", "TargetCondominiumId", "RequestedRole" },
                unique: true,
                filter: "\"Status\" = 0");

            migrationBuilder.CreateIndex(
                name: "IX_UserCondominiumAssociationRequests_ReviewedByUserId",
                table: "UserCondominiumAssociationRequests",
                column: "ReviewedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserCondominiumAssociationRequests");
        }
    }
}

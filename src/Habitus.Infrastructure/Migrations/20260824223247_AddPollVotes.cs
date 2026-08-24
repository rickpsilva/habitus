using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPollVotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Polls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    AnnouncementId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Polls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Polls_Announcements_AnnouncementId",
                        column: x => x.AnnouncementId,
                        principalTable: "Announcements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Polls_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Polls_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PollOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PollId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PollOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PollOptions_Polls_PollId",
                        column: x => x.PollId,
                        principalTable: "Polls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PollVotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PollId = table.Column<Guid>(type: "uuid", nullable: false),
                    PollOptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    VotedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    VotedAtUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PollVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PollVotes_PollOptions_PollOptionId",
                        column: x => x.PollOptionId,
                        principalTable: "PollOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PollVotes_Polls_PollId",
                        column: x => x.PollId,
                        principalTable: "Polls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PollVotes_Users_VotedByUserId",
                        column: x => x.VotedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "PlanFeatures",
                columns: new[] { "Id", "FeatureKey", "FeatureLabel", "IsEnabled", "PlanId" },
                values: new object[,]
                {
                    { new Guid("f1000004-0000-0000-0000-000000000000"), "polls", "Votações", false, new Guid("a0b0c001-0000-0000-0000-000000000000") },
                    { new Guid("f2000008-0000-0000-0000-000000000000"), "polls", "Votações", false, new Guid("a0b0c002-0000-0000-0000-000000000000") },
                    { new Guid("f3000011-0000-0000-0000-000000000000"), "polls", "Votações", true, new Guid("a0b0c003-0000-0000-0000-000000000000") }
                });

            migrationBuilder.CreateIndex(
                name: "IX_PollOptions_PollId_DisplayOrder",
                table: "PollOptions",
                columns: new[] { "PollId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Polls_AnnouncementId",
                table: "Polls",
                column: "AnnouncementId");

            migrationBuilder.CreateIndex(
                name: "IX_Polls_CondominiumId_Status_ExpiresAtUtc",
                table: "Polls",
                columns: new[] { "CondominiumId", "Status", "ExpiresAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Polls_CreatedByUserId",
                table: "Polls",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PollVotes_PollId_PollOptionId",
                table: "PollVotes",
                columns: new[] { "PollId", "PollOptionId" });

            migrationBuilder.CreateIndex(
                name: "IX_PollVotes_PollId_VotedByUserId",
                table: "PollVotes",
                columns: new[] { "PollId", "VotedByUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PollVotes_PollOptionId",
                table: "PollVotes",
                column: "PollOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_PollVotes_VotedByUserId",
                table: "PollVotes",
                column: "VotedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PollVotes");

            migrationBuilder.DropTable(
                name: "PollOptions");

            migrationBuilder.DropTable(
                name: "Polls");

            migrationBuilder.DeleteData(
                table: "PlanFeatures",
                keyColumn: "Id",
                keyValue: new Guid("f1000004-0000-0000-0000-000000000000"));

            migrationBuilder.DeleteData(
                table: "PlanFeatures",
                keyColumn: "Id",
                keyValue: new Guid("f2000008-0000-0000-0000-000000000000"));

            migrationBuilder.DeleteData(
                table: "PlanFeatures",
                keyColumn: "Id",
                keyValue: new Guid("f3000011-0000-0000-0000-000000000000"));
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConsentDefinitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Body = table.Column<string>(type: "text", nullable: true),
                    IsMandatory = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsentDefinitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserConsents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsentDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Accepted = table.Column<bool>(type: "boolean", nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserConsents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserConsents_ConsentDefinitions_ConsentDefinitionId",
                        column: x => x.ConsentDefinitionId,
                        principalTable: "ConsentDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserConsents_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConsentDefinitions_IsActive_IsMandatory",
                table: "ConsentDefinitions",
                columns: new[] { "IsActive", "IsMandatory" });

            migrationBuilder.CreateIndex(
                name: "IX_ConsentDefinitions_Key_Version",
                table: "ConsentDefinitions",
                columns: new[] { "Key", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserConsents_ConsentDefinitionId",
                table: "UserConsents",
                column: "ConsentDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_UserConsents_UserId_ConsentDefinitionId",
                table: "UserConsents",
                columns: new[] { "UserId", "ConsentDefinitionId" });

            migrationBuilder.CreateIndex(
                name: "IX_UserConsents_UserId_DecidedAt",
                table: "UserConsents",
                columns: new[] { "UserId", "DecidedAt" });

            // Seed the initial mandatory consent definitions so the RGPD gate has something to
            // require out of the box. Idempotent: ON CONFLICT on the (Key, Version) unique index
            // means re-running (or applying over a partially-seeded DB) is a no-op.
            migrationBuilder.Sql(
                "INSERT INTO \"ConsentDefinitions\" " +
                "(\"Id\",\"Key\",\"Version\",\"Title\",\"Url\",\"Body\",\"IsMandatory\",\"IsActive\",\"CreatedAt\") VALUES " +
                "('11111111-1111-1111-1111-111111111111','terms','1.0','Termos de Utilização',NULL,NULL,true,true,now()), " +
                "('22222222-2222-2222-2222-222222222222','privacy','1.0','Política de Privacidade',NULL,NULL,true,true,now()) " +
                "ON CONFLICT (\"Key\",\"Version\") DO NOTHING;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserConsents");

            migrationBuilder.DropTable(
                name: "ConsentDefinitions");
        }
    }
}

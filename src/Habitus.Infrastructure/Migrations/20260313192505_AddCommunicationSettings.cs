using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCommunicationSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CommunicationSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmailEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    EmailSmtpHost = table.Column<string>(type: "text", nullable: true),
                    EmailSmtpPort = table.Column<int>(type: "integer", nullable: true),
                    EmailUsername = table.Column<string>(type: "text", nullable: true),
                    EmailPassword = table.Column<string>(type: "text", nullable: true),
                    EmailFromAddress = table.Column<string>(type: "text", nullable: true),
                    EmailFromName = table.Column<string>(type: "text", nullable: true),
                    EmailUseSsl = table.Column<bool>(type: "boolean", nullable: false),
                    WhatsAppEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    WhatsAppPhoneNumber = table.Column<string>(type: "text", nullable: true),
                    WhatsAppApiKey = table.Column<string>(type: "text", nullable: true),
                    WhatsAppApiProvider = table.Column<string>(type: "text", nullable: true),
                    WhatsAppGroupId = table.Column<string>(type: "text", nullable: true),
                    SmsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    SmsProvider = table.Column<string>(type: "text", nullable: true),
                    SmsApiKey = table.Column<string>(type: "text", nullable: true),
                    SmsFromNumber = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommunicationSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CommunicationSettings_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CommunicationSettings_CondominiumId",
                table: "CommunicationSettings",
                column: "CondominiumId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CommunicationSettings");
        }
    }
}

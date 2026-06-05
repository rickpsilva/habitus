using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveEmailFromAddressAndFromNameFieldsComunicationSetting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailFromAddress",
                table: "CommunicationSettings");

            migrationBuilder.DropColumn(
                name: "EmailFromName",
                table: "CommunicationSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmailFromAddress",
                table: "CommunicationSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailFromName",
                table: "CommunicationSettings",
                type: "text",
                nullable: true);
        }
    }
}

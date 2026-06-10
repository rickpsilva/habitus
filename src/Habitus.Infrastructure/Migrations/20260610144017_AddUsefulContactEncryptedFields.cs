using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUsefulContactEncryptedFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AddressEncrypted",
                table: "UsefulContacts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailEncrypted",
                table: "UsefulContacts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LocalityEncrypted",
                table: "UsefulContacts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneEncrypted",
                table: "UsefulContacts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PostalCodeEncrypted",
                table: "UsefulContacts",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AddressEncrypted",
                table: "UsefulContacts");

            migrationBuilder.DropColumn(
                name: "EmailEncrypted",
                table: "UsefulContacts");

            migrationBuilder.DropColumn(
                name: "LocalityEncrypted",
                table: "UsefulContacts");

            migrationBuilder.DropColumn(
                name: "PhoneEncrypted",
                table: "UsefulContacts");

            migrationBuilder.DropColumn(
                name: "PostalCodeEncrypted",
                table: "UsefulContacts");
        }
    }
}

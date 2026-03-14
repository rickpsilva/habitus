using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EnhanceNotificationDispatchDeliveryState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Attempts",
                table: "NotificationDispatchDeliveries",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastAttemptAt",
                table: "NotificationDispatchDeliveries",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastError",
                table: "NotificationDispatchDeliveries",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SentAt",
                table: "NotificationDispatchDeliveries",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "NotificationDispatchDeliveries",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Sent");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "NotificationDispatchDeliveries",
                type: "timestamp without time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Attempts",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropColumn(
                name: "LastAttemptAt",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropColumn(
                name: "LastError",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropColumn(
                name: "SentAt",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "NotificationDispatchDeliveries");
        }
    }
}

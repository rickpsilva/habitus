using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RefactorNotificationDispatchDeliveryToUseUserIdAndExternalId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_NotificationDispatchDeliveries_Channel_DispatchKey_Recipient",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropColumn(
                name: "Recipient",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.AddColumn<string>(
                name: "RecipientExternalId",
                table: "NotificationDispatchDeliveries",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RecipientUserId",
                table: "NotificationDispatchDeliveries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_NotificationDispatchDeliveries_RecipientUserId",
                table: "NotificationDispatchDeliveries",
                column: "RecipientUserId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationDispatchDelivery_Unique_Delivery",
                table: "NotificationDispatchDeliveries",
                columns: new[] { "Channel", "DispatchKey", "RecipientUserId", "RecipientExternalId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_NotificationDispatchDeliveries_Users_RecipientUserId",
                table: "NotificationDispatchDeliveries",
                column: "RecipientUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_NotificationDispatchDeliveries_Users_RecipientUserId",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropIndex(
                name: "IX_NotificationDispatchDeliveries_RecipientUserId",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropIndex(
                name: "IX_NotificationDispatchDelivery_Unique_Delivery",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropColumn(
                name: "RecipientExternalId",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.DropColumn(
                name: "RecipientUserId",
                table: "NotificationDispatchDeliveries");

            migrationBuilder.AddColumn<string>(
                name: "Recipient",
                table: "NotificationDispatchDeliveries",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationDispatchDeliveries_Channel_DispatchKey_Recipient",
                table: "NotificationDispatchDeliveries",
                columns: new[] { "Channel", "DispatchKey", "Recipient" },
                unique: true);
        }
    }
}

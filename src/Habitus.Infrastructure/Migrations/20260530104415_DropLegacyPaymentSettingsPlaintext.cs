using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropLegacyPaymentSettingsPlaintext : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "PaymentSettings"
                SET
                    "BankTransferIbanEncrypted" = COALESCE(NULLIF("BankTransferIbanEncrypted", ''), NULLIF(BTRIM("BankTransferIban"), '')),
                    "BankTransferAccountHolderEncrypted" = COALESCE(NULLIF("BankTransferAccountHolderEncrypted", ''), NULLIF(BTRIM("BankTransferAccountHolder"), '')),
                    "PaymentInstructionsEncrypted" = COALESCE(NULLIF("PaymentInstructionsEncrypted", ''), NULLIF(BTRIM("PaymentInstructions"), '')),
                    "MBReferenceEntityEncrypted" = COALESCE(NULLIF("MBReferenceEntityEncrypted", ''), NULLIF(BTRIM("MBReferenceEntity"), '')),
                    "MBReferenceReferenceEncrypted" = COALESCE(NULLIF("MBReferenceReferenceEncrypted", ''), NULLIF(BTRIM("MBReferenceReference"), '')),
                    "MBWayPhoneNumberEncrypted" = COALESCE(NULLIF("MBWayPhoneNumberEncrypted", ''), NULLIF(BTRIM("MBWayPhoneNumber"), '')),
                    "MBWayMerchantIdEncrypted" = COALESCE(NULLIF("MBWayMerchantIdEncrypted", ''), NULLIF(BTRIM("MBWayMerchantId"), '')),
                    "CardSecretKeyEncrypted" = COALESCE(NULLIF("CardSecretKeyEncrypted", ''), NULLIF(BTRIM("CardSecretKey"), '')),
                    "CardMerchantIdEncrypted" = COALESCE(NULLIF("CardMerchantIdEncrypted", ''), NULLIF(BTRIM("CardMerchantId"), '')),
                    "UpdatedAt" = NOW()
                WHERE
                    "BankTransferIban" IS NOT NULL OR
                    "BankTransferAccountHolder" IS NOT NULL OR
                    "PaymentInstructions" IS NOT NULL OR
                    "MBReferenceEntity" IS NOT NULL OR
                    "MBReferenceReference" IS NOT NULL OR
                    "MBWayPhoneNumber" IS NOT NULL OR
                    "MBWayMerchantId" IS NOT NULL OR
                    "CardSecretKey" IS NOT NULL OR
                    "CardMerchantId" IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "BankTransferAccountHolder",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "BankTransferIban",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "CardMerchantId",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "CardSecretKey",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "MBReferenceEntity",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "MBReferenceReference",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "MBWayMerchantId",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "MBWayPhoneNumber",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "PaymentInstructions",
                table: "PaymentSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankTransferAccountHolder",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankTransferIban",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CardMerchantId",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CardSecretKey",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MBReferenceEntity",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MBReferenceReference",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MBWayMerchantId",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MBWayPhoneNumber",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentInstructions",
                table: "PaymentSettings",
                type: "text",
                nullable: true);
        }
    }
}

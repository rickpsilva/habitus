using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ConsolidatePaymentSettingsEncryption : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankTransferAccountHolderEncrypted",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CardMerchantIdEncrypted",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MBReferenceEntityEncrypted",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MBReferenceReferenceEncrypted",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MBWayMerchantIdEncrypted",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MBWayPhoneNumberEncrypted",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentInstructions",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentInstructionsEncrypted",
                table: "PaymentSettings",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("""
                INSERT INTO "PaymentSettings"
                (
                    "Id",
                    "CondominiumId",
                    "BankTransferEnabled",
                    "BankTransferIban",
                    "BankTransferIbanEncrypted",
                    "PaymentInstructions",
                    "MBReferenceEnabled",
                    "MBReferenceEntity",
                    "MBReferenceReference",
                    "MBWayEnabled",
                    "MBWayPhoneNumber",
                    "CardEnabled",
                    "CreatedAt",
                    "UpdatedAt"
                )
                SELECT
                    c."Id",
                    c."Id",
                    c."PaymentBankTransferEnabled",
                    c."PaymentIban",
                    c."PaymentIbanEncrypted",
                    c."PaymentInstructions",
                    NOT (c."PaymentMbReference" IS NULL OR btrim(c."PaymentMbReference") = ''),
                    CASE
                        WHEN c."PaymentMbReference" IS NULL THEN NULL
                        WHEN position('|' in c."PaymentMbReference") > 0 THEN btrim(split_part(c."PaymentMbReference", '|', 1))
                        ELSE NULL
                    END,
                    CASE
                        WHEN c."PaymentMbReference" IS NULL THEN NULL
                        WHEN position('|' in c."PaymentMbReference") > 0 THEN btrim(split_part(c."PaymentMbReference", '|', 2))
                        ELSE btrim(c."PaymentMbReference")
                    END,
                    c."PaymentMbWayEnabled",
                    c."PaymentMbWay",
                    c."PaymentCardEnabled",
                    NOW(),
                    NOW()
                FROM "Condominiums" c
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM "PaymentSettings" ps
                    WHERE ps."CondominiumId" = c."Id"
                );
                """);

            migrationBuilder.Sql("""
                UPDATE "PaymentSettings" ps
                SET
                    "BankTransferIban" = COALESCE(ps."BankTransferIban", c."PaymentIban"),
                    "BankTransferIbanEncrypted" = COALESCE(ps."BankTransferIbanEncrypted", c."PaymentIbanEncrypted"),
                    "PaymentInstructions" = COALESCE(ps."PaymentInstructions", c."PaymentInstructions"),
                    "MBWayPhoneNumber" = COALESCE(ps."MBWayPhoneNumber", c."PaymentMbWay"),
                    "MBReferenceEntity" = COALESCE(
                        ps."MBReferenceEntity",
                        CASE
                            WHEN c."PaymentMbReference" IS NULL THEN NULL
                            WHEN position('|' in c."PaymentMbReference") > 0 THEN btrim(split_part(c."PaymentMbReference", '|', 1))
                            ELSE NULL
                        END
                    ),
                    "MBReferenceReference" = COALESCE(
                        ps."MBReferenceReference",
                        CASE
                            WHEN c."PaymentMbReference" IS NULL THEN NULL
                            WHEN position('|' in c."PaymentMbReference") > 0 THEN btrim(split_part(c."PaymentMbReference", '|', 2))
                            ELSE btrim(c."PaymentMbReference")
                        END
                    ),
                    "UpdatedAt" = NOW()
                FROM "Condominiums" c
                WHERE ps."CondominiumId" = c."Id";
                """);

            migrationBuilder.DropColumn(
                name: "PaymentBankTransferEnabled",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PaymentCardEnabled",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PaymentIban",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PaymentIbanEncrypted",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PaymentInstructions",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PaymentMbReference",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PaymentMbWay",
                table: "Condominiums");

            migrationBuilder.DropColumn(
                name: "PaymentMbWayEnabled",
                table: "Condominiums");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankTransferAccountHolderEncrypted",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "CardMerchantIdEncrypted",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "MBReferenceEntityEncrypted",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "MBReferenceReferenceEncrypted",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "MBWayMerchantIdEncrypted",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "MBWayPhoneNumberEncrypted",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "PaymentInstructions",
                table: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "PaymentInstructionsEncrypted",
                table: "PaymentSettings");

            migrationBuilder.AddColumn<bool>(
                name: "PaymentBankTransferEnabled",
                table: "Condominiums",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PaymentCardEnabled",
                table: "Condominiums",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PaymentIban",
                table: "Condominiums",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentIbanEncrypted",
                table: "Condominiums",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentInstructions",
                table: "Condominiums",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMbReference",
                table: "Condominiums",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMbWay",
                table: "Condominiums",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PaymentMbWayEnabled",
                table: "Condominiums",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}

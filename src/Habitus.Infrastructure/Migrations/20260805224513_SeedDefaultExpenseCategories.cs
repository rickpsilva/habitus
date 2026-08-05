using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedDefaultExpenseCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Seed default expense categories for existing condominiums that have none yet.
            var defaultCategories = new (string Name, string NormalizedName, string Hashtag)[]
            {
                ("Manutenção", "manutenção", "manutencao"),
                ("Seguros", "seguros", "seguros"),
                ("Consumos comuns", "consumos comuns", "consumos"),
                ("Honorários administração", "honorários administração", "administracao"),
                ("Serviços", "serviços", "servicos"),
                ("IMI parte comum", "imi parte comum", "imi"),
                ("Serviços jurídicos", "serviços jurídicos", "juridicos"),
                ("Contabilista", "contabilista", "contabilista"),
                ("Outras despesas", "outras despesas", "outras")
            };

            foreach (var (name, normalizedName, hashtag) in defaultCategories)
            {
                migrationBuilder.Sql($"""
                    INSERT INTO "ExpenseCategories" ("Id", "Name", "NormalizedName", "Hashtags", "IsActive", "IsDeleted", "CreatedAt", "UpdatedAt", "CondominiumId")
                    SELECT gen_random_uuid(), '{name}', '{normalizedName}', '{hashtag}', true, false, NOW(), NOW(), c."Id"
                    FROM "Condominiums" c
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "ExpenseCategories" ec
                        WHERE ec."CondominiumId" = c."Id" AND ec."NormalizedName" = '{normalizedName}' AND ec."IsDeleted" = false
                    );
                    """);
            }

            // Map existing expense records without a category to the "Outras despesas" category
            // of their condominium so historical data remains usable.
            migrationBuilder.Sql("""
                UPDATE "FinancialRecords" fr
                SET "ExpenseCategoryId" = ec."Id"
                FROM "ExpenseCategories" ec
                WHERE fr."Type" = 1
                  AND fr."ExpenseCategoryId" IS NULL
                  AND ec."CondominiumId" = fr."CondominiumId"
                  AND ec."NormalizedName" = 'outras despesas'
                  AND ec."IsDeleted" = false;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM "ExpenseCategories"
                WHERE "NormalizedName" IN (
                    'manutenção', 'seguros', 'consumos comuns', 'honorários administração',
                    'serviços', 'imi parte comum', 'serviços jurídicos', 'contabilista', 'outras despesas'
                );
                """);
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedDefaultSubscriptionPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO ""SubscriptionPlans""
    (""Id"", ""Name"", ""Tier"", ""Description"", ""PriceMonthly"", ""AnnualDiscountPercent"", ""QuinquennialDiscountPercent"", ""PriceAnnual"", ""PriceQuinquennial"", ""IsActive"")
VALUES
    ('a0b0c001-0000-0000-0000-000000000000', 'Free',   0, 'Base operacional com features essenciais.', 0.00,  0.00,  0.00,    0.00,    0.00,  TRUE),
    ('a0b0c002-0000-0000-0000-000000000000', 'Silver', 1, 'Automações e módulos avançados para condomínios em crescimento.', 29.90, 17.00, 30.00,  299.00, 1299.00, TRUE),
    ('a0b0c003-0000-0000-0000-000000000000', 'Gold',   2, 'Controlo total: analytics, WhatsApp e acesso à API REST.', 59.90, 17.00, 30.00,  599.00, 2499.00, TRUE)
ON CONFLICT (""Id"") DO UPDATE
SET
    ""Name"" = EXCLUDED.""Name"",
    ""Tier"" = EXCLUDED.""Tier"",
    ""Description"" = EXCLUDED.""Description"",
    ""PriceMonthly"" = EXCLUDED.""PriceMonthly"",
    ""AnnualDiscountPercent"" = EXCLUDED.""AnnualDiscountPercent"",
    ""QuinquennialDiscountPercent"" = EXCLUDED.""QuinquennialDiscountPercent"",
    ""PriceAnnual"" = EXCLUDED.""PriceAnnual"",
    ""PriceQuinquennial"" = EXCLUDED.""PriceQuinquennial"",
    ""IsActive"" = EXCLUDED.""IsActive"";

INSERT INTO ""PlanFeatures""
    (""Id"", ""PlanId"", ""FeatureKey"", ""FeatureLabel"", ""IsEnabled"")
VALUES
    ('f1000001-0000-0000-0000-000000000000', 'a0b0c001-0000-0000-0000-000000000000', 'maintenance',            'Manutenção',              TRUE),
    ('f1000002-0000-0000-0000-000000000000', 'a0b0c001-0000-0000-0000-000000000000', 'announcements',          'Comunicados',             TRUE),
    ('f1000003-0000-0000-0000-000000000000', 'a0b0c001-0000-0000-0000-000000000000', 'documents',              'Documentos (até 10)',     TRUE),

    ('f2000001-0000-0000-0000-000000000000', 'a0b0c002-0000-0000-0000-000000000000', 'maintenance',            'Manutenção',              TRUE),
    ('f2000002-0000-0000-0000-000000000000', 'a0b0c002-0000-0000-0000-000000000000', 'announcements',          'Comunicados',             TRUE),
    ('f2000003-0000-0000-0000-000000000000', 'a0b0c002-0000-0000-0000-000000000000', 'documents',              'Documentos (ilimitados)', TRUE),
    ('f2000004-0000-0000-0000-000000000000', 'a0b0c002-0000-0000-0000-000000000000', 'reservations',           'Reservas de Espaços',     TRUE),
    ('f2000005-0000-0000-0000-000000000000', 'a0b0c002-0000-0000-0000-000000000000', 'financial',              'Gestão Financeira',       TRUE),
    ('f2000006-0000-0000-0000-000000000000', 'a0b0c002-0000-0000-0000-000000000000', 'assemblies',             'Assembleias',             TRUE),
    ('f2000007-0000-0000-0000-000000000000', 'a0b0c002-0000-0000-0000-000000000000', 'email_notifications',    'Notificações por Email',  TRUE),

    ('f3000001-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'maintenance',            'Manutenção',              TRUE),
    ('f3000002-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'announcements',          'Comunicados',             TRUE),
    ('f3000003-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'documents',              'Documentos (ilimitados)', TRUE),
    ('f3000004-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'reservations',           'Reservas de Espaços',     TRUE),
    ('f3000005-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'financial',              'Gestão Financeira',       TRUE),
    ('f3000006-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'assemblies',             'Assembleias',             TRUE),
    ('f3000007-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'email_notifications',    'Notificações por Email',  TRUE),
    ('f3000008-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'analytics',              'Analytics Avançado',      TRUE),
    ('f3000009-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'whatsapp_notifications', 'Notificações WhatsApp',   TRUE),
    ('f3000010-0000-0000-0000-000000000000', 'a0b0c003-0000-0000-0000-000000000000', 'api_access',             'Acesso à API REST',       TRUE)
ON CONFLICT (""PlanId"", ""FeatureKey"") DO UPDATE
SET
    ""FeatureLabel"" = EXCLUDED.""FeatureLabel"",
    ""IsEnabled"" = EXCLUDED.""IsEnabled"";
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally left empty: this migration enforces canonical seeded plan data.
        }
    }
}

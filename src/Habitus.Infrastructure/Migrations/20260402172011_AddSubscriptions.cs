using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SubscriptionPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Tier = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    PriceMonthly = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PriceAnnual = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PriceQuinquennial = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CondominiumSubscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    BillingCycle = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    NextBillingDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    PriceAtPurchase = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CondominiumSubscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CondominiumSubscriptions_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CondominiumSubscriptions_SubscriptionPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "SubscriptionPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlanFeatures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    FeatureKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FeatureLabel = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanFeatures", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanFeatures_SubscriptionPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "SubscriptionPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "SubscriptionPlans",
                columns: new[] { "Id", "Description", "IsActive", "Name", "PriceAnnual", "PriceMonthly", "PriceQuinquennial", "Tier" },
                values: new object[,]
                {
                    { new Guid("a0b0c001-0000-0000-0000-000000000000"), "Base operacional com features essenciais.", true, "Free", 0m, 0m, 0m, 0 },
                    { new Guid("a0b0c002-0000-0000-0000-000000000000"), "Automações e módulos avançados para condomínios em crescimento.", true, "Silver", 299.00m, 29.90m, 1299.00m, 1 },
                    { new Guid("a0b0c003-0000-0000-0000-000000000000"), "Controlo total: analytics, WhatsApp e acesso à API REST.", true, "Gold", 599.00m, 59.90m, 2499.00m, 2 }
                });

            migrationBuilder.InsertData(
                table: "PlanFeatures",
                columns: new[] { "Id", "FeatureKey", "FeatureLabel", "IsEnabled", "PlanId" },
                values: new object[,]
                {
                    { new Guid("f1000001-0000-0000-0000-000000000000"), "maintenance", "Manutenção", true, new Guid("a0b0c001-0000-0000-0000-000000000000") },
                    { new Guid("f1000002-0000-0000-0000-000000000000"), "announcements", "Comunicados", true, new Guid("a0b0c001-0000-0000-0000-000000000000") },
                    { new Guid("f1000003-0000-0000-0000-000000000000"), "documents", "Documentos (até 10)", true, new Guid("a0b0c001-0000-0000-0000-000000000000") },
                    { new Guid("f2000001-0000-0000-0000-000000000000"), "maintenance", "Manutenção", true, new Guid("a0b0c002-0000-0000-0000-000000000000") },
                    { new Guid("f2000002-0000-0000-0000-000000000000"), "announcements", "Comunicados", true, new Guid("a0b0c002-0000-0000-0000-000000000000") },
                    { new Guid("f2000003-0000-0000-0000-000000000000"), "documents", "Documentos (ilimitados)", true, new Guid("a0b0c002-0000-0000-0000-000000000000") },
                    { new Guid("f2000004-0000-0000-0000-000000000000"), "reservations", "Reservas de Espaços", true, new Guid("a0b0c002-0000-0000-0000-000000000000") },
                    { new Guid("f2000005-0000-0000-0000-000000000000"), "financial", "Gestão Financeira", true, new Guid("a0b0c002-0000-0000-0000-000000000000") },
                    { new Guid("f2000006-0000-0000-0000-000000000000"), "assemblies", "Assembleias", true, new Guid("a0b0c002-0000-0000-0000-000000000000") },
                    { new Guid("f2000007-0000-0000-0000-000000000000"), "email_notifications", "Notificações por Email", true, new Guid("a0b0c002-0000-0000-0000-000000000000") },
                    { new Guid("f3000001-0000-0000-0000-000000000000"), "maintenance", "Manutenção", true, new Guid("a0b0c003-0000-0000-0000-000000000000") },
                    { new Guid("f3000002-0000-0000-0000-000000000000"), "announcements", "Comunicados", true, new Guid("a0b0c003-0000-0000-0000-000000000000") },
                    { new Guid("f3000003-0000-0000-0000-000000000000"), "documents", "Documentos (ilimitados)", true, new Guid("a0b0c003-0000-0000-0000-000000000000") },
                    { new Guid("f3000004-0000-0000-0000-000000000000"), "reservations", "Reservas de Espaços", true, new Guid("a0b0c003-0000-0000-0000-000000000000") },
                    { new Guid("f3000005-0000-0000-0000-000000000000"), "financial", "Gestão Financeira", true, new Guid("a0b0c003-0000-0000-0000-000000000000") },
                    { new Guid("f3000006-0000-0000-0000-000000000000"), "assemblies", "Assembleias", true, new Guid("a0b0c003-0000-0000-0000-000000000000") },
                    { new Guid("f3000007-0000-0000-0000-000000000000"), "email_notifications", "Notificações por Email", true, new Guid("a0b0c003-0000-0000-0000-000000000000") },
                    { new Guid("f3000008-0000-0000-0000-000000000000"), "analytics", "Analytics Avançado", true, new Guid("a0b0c003-0000-0000-0000-000000000000") },
                    { new Guid("f3000009-0000-0000-0000-000000000000"), "whatsapp_notifications", "Notificações WhatsApp", true, new Guid("a0b0c003-0000-0000-0000-000000000000") },
                    { new Guid("f3000010-0000-0000-0000-000000000000"), "api_access", "Acesso à API REST", true, new Guid("a0b0c003-0000-0000-0000-000000000000") }
                });

            migrationBuilder.CreateIndex(
                name: "IX_CondominiumSubscriptions_CondominiumId",
                table: "CondominiumSubscriptions",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_CondominiumSubscriptions_PlanId",
                table: "CondominiumSubscriptions",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_CondominiumSubscriptions_Status",
                table: "CondominiumSubscriptions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PlanFeatures_PlanId_FeatureKey",
                table: "PlanFeatures",
                columns: new[] { "PlanId", "FeatureKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionPlans_Tier",
                table: "SubscriptionPlans",
                column: "Tier");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CondominiumSubscriptions");

            migrationBuilder.DropTable(
                name: "PlanFeatures");

            migrationBuilder.DropTable(
                name: "SubscriptionPlans");
        }
    }
}

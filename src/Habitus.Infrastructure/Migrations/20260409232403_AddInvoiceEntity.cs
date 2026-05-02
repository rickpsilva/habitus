using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Invoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    Series = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    IssuedDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    PaidDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CustomerTaxId = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CustomerAddress = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    SubscriptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PeriodStartDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    PeriodEndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    SubtotalAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    VatAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    VatRate = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    IssuedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    PdfPath = table.Column<string>(type: "text", nullable: true),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CancellationReason = table.Column<string>(type: "text", nullable: true),
                    OriginalInvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Invoices_CondominiumSubscriptions_SubscriptionId",
                        column: x => x.SubscriptionId,
                        principalTable: "CondominiumSubscriptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Invoices_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Invoices_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Invoices_Users_IssuedByUserId",
                        column: x => x.IssuedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Invoice_CondominiumIssued",
                table: "Invoices",
                columns: new[] { "CondominiumId", "IssuedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Invoice_CondominiumStatus",
                table: "Invoices",
                columns: new[] { "CondominiumId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Invoice_DueDate",
                table: "Invoices",
                column: "DueDate");

            migrationBuilder.CreateIndex(
                name: "IX_Invoice_Status",
                table: "Invoices",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Invoice_Unique_CondominiumYear",
                table: "Invoices",
                columns: new[] { "CondominiumId", "Year", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_DocumentId",
                table: "Invoices",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_IssuedByUserId",
                table: "Invoices",
                column: "IssuedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_SubscriptionId",
                table: "Invoices",
                column: "SubscriptionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Invoices");
        }
    }
}

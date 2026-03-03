using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MultiCondominiumSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assemblies_Buildings_BuildingId",
                table: "Assemblies");

            migrationBuilder.DropForeignKey(
                name: "FK_Documents_Buildings_BuildingId",
                table: "Documents");

            migrationBuilder.DropForeignKey(
                name: "FK_FinancialRecords_Buildings_BuildingId",
                table: "FinancialRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Buildings_BuildingId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_SharedSpaces_Buildings_BuildingId",
                table: "SharedSpaces");

            migrationBuilder.DropForeignKey(
                name: "FK_Suppliers_Buildings_BuildingId",
                table: "Suppliers");

            migrationBuilder.DropForeignKey(
                name: "FK_Units_Buildings_BuildingId",
                table: "Units");

            migrationBuilder.DropForeignKey(
                name: "FK_UsefulContacts_Buildings_BuildingId",
                table: "UsefulContacts");

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "UsefulContacts",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "UsefulContacts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Units",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "Units",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Suppliers",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "Suppliers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "SharedSpaces",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "SharedSpaces",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Residents",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Notifications",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "Notifications",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "FinancialRecords",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "FinancialRecords",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Documents",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "Documents",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Assemblies",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CondominiumId",
                table: "Assemblies",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "Condominiums",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: false),
                    TaxId = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Condominiums", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    PasswordResetToken = table.Column<string>(type: "text", nullable: true),
                    PasswordResetTokenExpiry = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Users_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "UserCondominiums",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    GrantedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CanManage = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserCondominiums", x => new { x.UserId, x.CondominiumId });
                    table.ForeignKey(
                        name: "FK_UserCondominiums_Condominiums_CondominiumId",
                        column: x => x.CondominiumId,
                        principalTable: "Condominiums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserCondominiums_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Migrate existing data from Buildings to Condominiums
            migrationBuilder.Sql(@"
                -- Copy Buildings to Condominiums
                INSERT INTO ""Condominiums"" (""Id"", ""Name"", ""Address"", ""TaxId"", ""CreatedAt"", ""IsActive"")
                SELECT ""Id"", ""Name"", ""Address"", ""AdminEmail"", NOW(), true
                FROM ""Buildings"";

                -- Update all foreign keys to point to Condominiums
                UPDATE ""Units"" SET ""CondominiumId"" = ""BuildingId"" WHERE ""BuildingId"" IS NOT NULL;
                UPDATE ""Documents"" SET ""CondominiumId"" = ""BuildingId"" WHERE ""BuildingId"" IS NOT NULL;
                UPDATE ""Suppliers"" SET ""CondominiumId"" = ""BuildingId"" WHERE ""BuildingId"" IS NOT NULL;
                UPDATE ""FinancialRecords"" SET ""CondominiumId"" = ""BuildingId"" WHERE ""BuildingId"" IS NOT NULL;
                UPDATE ""Assemblies"" SET ""CondominiumId"" = ""BuildingId"" WHERE ""BuildingId"" IS NOT NULL;
                UPDATE ""SharedSpaces"" SET ""CondominiumId"" = ""BuildingId"" WHERE ""BuildingId"" IS NOT NULL;
                UPDATE ""Notifications"" SET ""CondominiumId"" = ""BuildingId"" WHERE ""BuildingId"" IS NOT NULL;
                UPDATE ""UsefulContacts"" SET ""CondominiumId"" = ""BuildingId"" WHERE ""BuildingId"" IS NOT NULL;

                -- Migrate Residents to Users
                INSERT INTO ""Users"" (""Id"", ""Name"", ""Email"", ""Phone"", ""PasswordHash"", ""PasswordResetToken"", 
                                     ""PasswordResetTokenExpiry"", ""Role"", ""CreatedAt"", ""CondominiumId"", ""UnitId"")
                SELECT 
                    r.""Id"",
                    r.""Name"",
                    r.""Email"",
                    r.""Phone"",
                    r.""PasswordHash"",
                    r.""PasswordResetToken"",
                    r.""PasswordResetTokenExpiry"",
                    CASE 
                        WHEN r.""Role"" = 'Admin' THEN 1
                        WHEN r.""Role"" = 'Manager' THEN 0
                        ELSE 2
                    END,
                    r.""CreatedAt"",
                    u.""CondominiumId"",
                    r.""UnitId""
                FROM ""Residents"" r
                JOIN ""Units"" u ON u.""Id"" = r.""UnitId"";

                -- Create UserCondominium relationships for non-Manager users
                INSERT INTO ""UserCondominiums"" (""UserId"", ""CondominiumId"", ""GrantedAt"", ""CanManage"")
                SELECT 
                    u.""Id"",
                    u.""CondominiumId"",
                    NOW(),
                    CASE WHEN u.""Role"" = 1 THEN true ELSE false END
                FROM ""Users"" u
                WHERE u.""CondominiumId"" IS NOT NULL AND u.""Role"" != 0;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_UsefulContacts_CondominiumId",
                table: "UsefulContacts",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Units_CondominiumId",
                table: "Units",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_CondominiumId",
                table: "Suppliers",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_SharedSpaces_CondominiumId",
                table: "SharedSpaces",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_CondominiumId",
                table: "Notifications",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialRecords_CondominiumId",
                table: "FinancialRecords",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_CondominiumId",
                table: "Documents",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Assemblies_CondominiumId",
                table: "Assemblies",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Condominiums_TaxId",
                table: "Condominiums",
                column: "TaxId");

            migrationBuilder.CreateIndex(
                name: "IX_UserCondominiums_CondominiumId",
                table: "UserCondominiums",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_CondominiumId",
                table: "Users",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_UnitId",
                table: "Users",
                column: "UnitId");

            migrationBuilder.AddForeignKey(
                name: "FK_Assemblies_Buildings_BuildingId",
                table: "Assemblies",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Assemblies_Condominiums_CondominiumId",
                table: "Assemblies",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_Buildings_BuildingId",
                table: "Documents",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_Condominiums_CondominiumId",
                table: "Documents",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FinancialRecords_Buildings_BuildingId",
                table: "FinancialRecords",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FinancialRecords_Condominiums_CondominiumId",
                table: "FinancialRecords",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Buildings_BuildingId",
                table: "Notifications",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Condominiums_CondominiumId",
                table: "Notifications",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SharedSpaces_Buildings_BuildingId",
                table: "SharedSpaces",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SharedSpaces_Condominiums_CondominiumId",
                table: "SharedSpaces",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Suppliers_Buildings_BuildingId",
                table: "Suppliers",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Suppliers_Condominiums_CondominiumId",
                table: "Suppliers",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Units_Buildings_BuildingId",
                table: "Units",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Units_Condominiums_CondominiumId",
                table: "Units",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UsefulContacts_Buildings_BuildingId",
                table: "UsefulContacts",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UsefulContacts_Condominiums_CondominiumId",
                table: "UsefulContacts",
                column: "CondominiumId",
                principalTable: "Condominiums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assemblies_Buildings_BuildingId",
                table: "Assemblies");

            migrationBuilder.DropForeignKey(
                name: "FK_Assemblies_Condominiums_CondominiumId",
                table: "Assemblies");

            migrationBuilder.DropForeignKey(
                name: "FK_Documents_Buildings_BuildingId",
                table: "Documents");

            migrationBuilder.DropForeignKey(
                name: "FK_Documents_Condominiums_CondominiumId",
                table: "Documents");

            migrationBuilder.DropForeignKey(
                name: "FK_FinancialRecords_Buildings_BuildingId",
                table: "FinancialRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_FinancialRecords_Condominiums_CondominiumId",
                table: "FinancialRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Buildings_BuildingId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Condominiums_CondominiumId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_SharedSpaces_Buildings_BuildingId",
                table: "SharedSpaces");

            migrationBuilder.DropForeignKey(
                name: "FK_SharedSpaces_Condominiums_CondominiumId",
                table: "SharedSpaces");

            migrationBuilder.DropForeignKey(
                name: "FK_Suppliers_Buildings_BuildingId",
                table: "Suppliers");

            migrationBuilder.DropForeignKey(
                name: "FK_Suppliers_Condominiums_CondominiumId",
                table: "Suppliers");

            migrationBuilder.DropForeignKey(
                name: "FK_Units_Buildings_BuildingId",
                table: "Units");

            migrationBuilder.DropForeignKey(
                name: "FK_Units_Condominiums_CondominiumId",
                table: "Units");

            migrationBuilder.DropForeignKey(
                name: "FK_UsefulContacts_Buildings_BuildingId",
                table: "UsefulContacts");

            migrationBuilder.DropForeignKey(
                name: "FK_UsefulContacts_Condominiums_CondominiumId",
                table: "UsefulContacts");

            migrationBuilder.DropTable(
                name: "UserCondominiums");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Condominiums");

            migrationBuilder.DropIndex(
                name: "IX_UsefulContacts_CondominiumId",
                table: "UsefulContacts");

            migrationBuilder.DropIndex(
                name: "IX_Units_CondominiumId",
                table: "Units");

            migrationBuilder.DropIndex(
                name: "IX_Suppliers_CondominiumId",
                table: "Suppliers");

            migrationBuilder.DropIndex(
                name: "IX_SharedSpaces_CondominiumId",
                table: "SharedSpaces");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_CondominiumId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_FinancialRecords_CondominiumId",
                table: "FinancialRecords");

            migrationBuilder.DropIndex(
                name: "IX_Documents_CondominiumId",
                table: "Documents");

            migrationBuilder.DropIndex(
                name: "IX_Assemblies_CondominiumId",
                table: "Assemblies");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "UsefulContacts");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "Units");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "Suppliers");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "SharedSpaces");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "FinancialRecords");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "CondominiumId",
                table: "Assemblies");

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "UsefulContacts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Units",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Suppliers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "SharedSpaces",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Role",
                table: "Residents",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Notifications",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "FinancialRecords",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Documents",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BuildingId",
                table: "Assemblies",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Assemblies_Buildings_BuildingId",
                table: "Assemblies",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Documents_Buildings_BuildingId",
                table: "Documents",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FinancialRecords_Buildings_BuildingId",
                table: "FinancialRecords",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Buildings_BuildingId",
                table: "Notifications",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SharedSpaces_Buildings_BuildingId",
                table: "SharedSpaces",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Suppliers_Buildings_BuildingId",
                table: "Suppliers",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Units_Buildings_BuildingId",
                table: "Units",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UsefulContacts_Buildings_BuildingId",
                table: "UsefulContacts",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

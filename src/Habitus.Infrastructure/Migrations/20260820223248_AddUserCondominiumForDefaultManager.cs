using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserCondominiumForDefaultManager : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add UserCondominium entry for the default manager (ID: 00000000-0000-0000-0000-000000000002)
            // to all existing condominiums so they can impersonate admins/residents
            migrationBuilder.Sql(@"
                INSERT INTO ""UserCondominiums"" (""UserId"", ""CondominiumId"", ""GrantedAt"", ""CanManage"")
                SELECT 
                    '00000000-0000-0000-0000-000000000002',
                    c.""Id"",
                    NOW(),
                    true
                FROM ""Condominiums"" c
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM ""UserCondominiums"" uc
                    WHERE uc.""UserId"" = '00000000-0000-0000-0000-000000000002'
                    AND uc.""CondominiumId"" = c.""Id""
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM ""UserCondominiums""
                WHERE ""UserId"" = '00000000-0000-0000-0000-000000000002';
            ");
        }
    }
}

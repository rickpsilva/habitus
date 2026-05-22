using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedDefaultManagerUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                INSERT INTO ""Users"" (
                    ""Id"",
                    ""Name"",
                    ""Email"",
                    ""Phone"",
                    ""PasswordHash"",
                    ""Role"",
                    ""IsActive"",
                    ""CreatedAt"",
                    ""LastPasswordChangedAt"",
                    ""FailedLoginCount"",
                    ""TwoFactorEnabled""
                )
                SELECT
                    '00000000-0000-0000-0000-000000000002',
                    'Default User',
                    'default_user@habitus.com',
                    '',
                    '$2a$11$l2TjtLOThfV8dpAlIfjmROfd98hS6T3hoJAERXQKqwQI/76LRTby6',
                    0,
                    TRUE,
                    NOW(),
                    NOW(),
                    0,
                    FALSE
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM ""Users""
                    WHERE ""Email"" = 'default_user@habitus.com'
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM ""Users""
                WHERE ""Id"" = '00000000-0000-0000-0000-000000000002';
            ");
        }
    }
}

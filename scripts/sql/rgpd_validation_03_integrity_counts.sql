-- RGPD validation script 03
-- Purpose: basic integrity checks (total rows and active rows) before/after migration.
-- Database: PostgreSQL

SELECT 'Users.total' AS metric, count(*)::bigint AS value FROM "public"."Users"
UNION ALL
SELECT 'Users.active', count(*)::bigint FROM "public"."Users" WHERE "IsActive" = true
UNION ALL
SELECT 'Users.deleted', count(*)::bigint FROM "public"."Users" WHERE COALESCE("IsDeleted", false) = true
UNION ALL
SELECT 'Condominiums.total', count(*)::bigint FROM "public"."Condominiums"
UNION ALL
SELECT 'Invoices.total', count(*)::bigint FROM "public"."Invoices"
UNION ALL
SELECT 'UserGdprConsents.total', count(*)::bigint FROM "public"."UserGdprConsents"
ORDER BY metric;

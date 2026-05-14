-- RGPD validation script 01
-- Purpose: compare legacy plaintext columns vs encrypted columns where both may coexist.
-- Database: PostgreSQL

WITH checks AS (
    SELECT
        table_schema,
        table_name,
        legacy_column,
        encrypted_column
    FROM (
        VALUES
            ('public', 'Condominiums', 'TaxId', 'TaxIdEncrypted'),
            ('public', 'Condominiums', 'PaymentIban', 'PaymentIbanEncrypted'),
            ('public', 'Invoices', 'CustomerTaxId', 'CustomerTaxIdEncrypted')
    ) AS v(table_schema, table_name, legacy_column, encrypted_column)
),
column_presence AS (
    SELECT
        c.table_schema,
        c.table_name,
        c.legacy_column,
        c.encrypted_column,
        EXISTS (
            SELECT 1
            FROM information_schema.columns ic
            WHERE ic.table_schema = c.table_schema
              AND ic.table_name = c.table_name
              AND ic.column_name = c.legacy_column
        ) AS has_legacy,
        EXISTS (
            SELECT 1
            FROM information_schema.columns ic
            WHERE ic.table_schema = c.table_schema
              AND ic.table_name = c.table_name
              AND ic.column_name = c.encrypted_column
        ) AS has_encrypted
    FROM checks c
)
SELECT
    table_schema,
    table_name,
    legacy_column,
    encrypted_column,
    has_legacy,
    has_encrypted,
    CASE
        WHEN has_legacy AND has_encrypted THEN
            format(
                'Run: SELECT count(*) FILTER (WHERE "%s" IS NOT NULL AND btrim("%s") <> '''') AS legacy_non_null, count(*) FILTER (WHERE "%s" IS NOT NULL AND btrim("%s") <> '''') AS encrypted_non_null FROM "%s"."%s";',
                legacy_column,
                legacy_column,
                encrypted_column,
                encrypted_column,
                table_schema,
                table_name
            )
        ELSE 'Skipped: one or both columns missing in current schema.'
    END AS next_step
FROM column_presence
ORDER BY table_name, legacy_column;

-- RGPD validation script 02
-- Purpose: verify legacy plaintext columns are NULL after migration.
-- Database: PostgreSQL

DO $$
DECLARE
    rec RECORD;
    sql_text text;
BEGIN
    RAISE NOTICE 'Checking legacy columns expected to be NULL...';

    FOR rec IN
        SELECT *
        FROM (
            VALUES
                ('public', 'Condominiums', 'TaxId'),
                ('public', 'Condominiums', 'PaymentIban'),
                ('public', 'Invoices', 'CustomerTaxId')
        ) AS v(table_schema, table_name, column_name)
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = rec.table_schema
              AND c.table_name = rec.table_name
              AND c.column_name = rec.column_name
        ) THEN
            sql_text := format(
                'SELECT count(*) FILTER (WHERE "%1$s" IS NOT NULL AND btrim("%1$s") <> '''') AS non_null_rows FROM "%2$s"."%3$s";',
                rec.column_name,
                rec.table_schema,
                rec.table_name
            );

            RAISE NOTICE 'Table %.%, column % -> %', rec.table_schema, rec.table_name, rec.column_name, sql_text;
            EXECUTE sql_text;
        ELSE
            RAISE NOTICE 'Skipped %.% column % (not found).', rec.table_schema, rec.table_name, rec.column_name;
        END IF;
    END LOOP;
END $$;

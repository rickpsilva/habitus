# RGPD SQL Validation Scripts

These scripts support Phase 5.20 of the RGPD plan.

## Files

- `rgpd_validation_01_plaintext_vs_encrypted.sql`
  - Lists target legacy/encrypted pairs and prints a query to compare non-null counts.
- `rgpd_validation_02_legacy_columns_null.sql`
  - Checks whether legacy plaintext columns are now null after migration.
- `rgpd_validation_03_integrity_counts.sql`
  - Captures baseline table counts to verify no data loss after migration.

## Usage

Run with `psql`:

```bash
psql "$DATABASE_URL" -f scripts/sql/rgpd_validation_01_plaintext_vs_encrypted.sql
psql "$DATABASE_URL" -f scripts/sql/rgpd_validation_02_legacy_columns_null.sql
psql "$DATABASE_URL" -f scripts/sql/rgpd_validation_03_integrity_counts.sql
```

Tip: execute script 03 before and after migration and compare results.

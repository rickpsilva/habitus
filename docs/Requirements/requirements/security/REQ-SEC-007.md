---
id: REQ-SEC-007
title: PII is persisted only in encrypted form and redundant plaintext columns are removed (data minimization)
type: Non-Functional
module: Security
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-SEC-001
  - REQ-SEC-003
  - REQ-SEC-004
  - REQ-CONDO-001
  - REQ-SUPP-001
  - REQ-FIN-001
designRefs:
  - docs/Requirements/diagrams/classes/privacy-services.mmd
implementationRefs:
  - src/Habitus.Infrastructure/Migrations/20260731120705_DropLegacyPlaintextPii.cs
  - src/Habitus.Domain/Entities/User.cs
  - src/Habitus.Domain/Entities/Condominium.cs
  - src/Habitus.Domain/Entities/Supplier.cs
  - src/Habitus.Domain/Entities/UsefulContact.cs
  - src/Habitus.Domain/Entities/Invoice.cs
  - src/Habitus.Infrastructure/Data/HabitusDbContext.cs
  - src/Habitus.Infrastructure/DependencyInjection.cs
  - src/Habitus.Application/Services/AuthService.cs
  - src/Habitus.Application/Services/UserService.cs
  - src/Habitus.Application/Services/CondominiumService.cs
  - src/Habitus.Application/Services/NotificationDispatchService.cs
  - src/Habitus.Application/Services/PersonalDataService.cs
  - src/Habitus.Application/Services/ReceiptService.cs
  - src/Habitus.Api/Controllers/SuppliersController.cs
  - src/Habitus.Api/Controllers/UsefulContactsController.cs
testRefs:
  - tests/Habitus.Tests/AuthServiceTests.cs
  - tests/Habitus.Tests/UserServicePhoneEncryptionTests.cs
  - tests/Habitus.Tests/CondominiumServiceAddressEncryptionTests.cs
  - tests/Habitus.Tests/PersonalDataServiceTests.cs
  - tests/Habitus.Tests/PersonalDataServiceIsolationTests.cs
  - tests/Habitus.Api.IntegrationTests/PersonalDataExportIntegrationTests.cs
  - tests/Habitus.Api.IntegrationTests/PersonalDataErasureIntegrationTests.cs
---

# REQ-SEC-007

Personal and sensitive identifiers (PII) are persisted only in their encrypted form. The obsolete plaintext columns that were superseded by encrypted counterparts (naming pattern `<Property>Encrypted`, with an accompanying `<Property>Hash` where lookups are required) are removed from the schema and the domain model, and the transitional backfill hosted-services that populated the encrypted columns are decommissioned. After this change, encryption at rest is the single source of truth for these fields, realizing the GDPR / RGPD data-minimization principle (Art. 5(1)(c)) and reinforcing REQ-SEC-001 (encryption at rest).

## Scope: Plaintext Columns To Be Removed

The following plaintext columns are obsolete and MUST be removed. The encrypted (and, where present, hash) counterparts in parentheses are retained as the sole persisted representation:

- `User.Email`, `User.Phone` (retain `User.EmailEncrypted` + `User.EmailHash`, `User.PhoneEncrypted`)
- `Condominium.Address`, `Condominium.Email` (retain `Condominium.AddressEncrypted`, `Condominium.EmailEncrypted`)
- `Supplier.Email`, `Supplier.Phone`, `Supplier.Address` (retain `Supplier.EmailEncrypted`, `Supplier.PhoneEncrypted`, `Supplier.AddressEncrypted`)
- `UsefulContact.Phone` (retain `UsefulContact.PhoneEncrypted`)
- `Invoice.CustomerTaxId` — currently marked `[Obsolete]` (retain `Invoice.CustomerTaxIdEncrypted`)

## Read Path

- All read/query paths resolve these fields exclusively from the encrypted columns (decrypting on demand for authorized use) and MUST NOT fall back to a plaintext column.
- Hash columns (e.g. `User.EmailHash`) remain the mechanism for equality lookups / uniqueness where a lookup is required; queries do not scan plaintext.

## Backfill Decommissioning

- The one-time/transitional backfill `IHostedService` implementations that copied plaintext values into the `*Encrypted` columns are removed once the encrypted columns are fully populated, because they no longer have a source column to read from and their purpose is complete.

## Migration Safety (Additive-Safe / Sequenced)

- The drop migration follows the established legacy-plaintext-drop pattern (as in `DropLegacyPaymentSettingsPlaintext` and `DropLegacyCondominiumTaxId`): a plaintext column is dropped only after the corresponding encrypted column exists and has been backfilled for all rows.
- Dropping is destructive and irreversible for the plaintext copy; the migration therefore assumes the backfill has completed and the encrypted column is the verified source of truth before any column is dropped.
- Multi-condominium isolation and role-based access rules are unaffected: no cross-tenant data is exposed or altered by the schema change.

## Acceptance Criteria

- Given the database schema after this change, when the `User`, `Condominium`, `Supplier`, `UsefulContact`, and `Invoice` tables are inspected, then none of the listed plaintext PII columns (`User.Email`, `User.Phone`, `Condominium.Address`, `Condominium.Email`, `Supplier.Email`, `Supplier.Phone`, `Supplier.Address`, `UsefulContact.Phone`, `Invoice.CustomerTaxId`) exist, and only their `*Encrypted` (and `*Hash` where applicable) counterparts remain.
- Given any read, query, export, or serialization path for the affected entities, when a PII field is resolved, then the value is obtained by decrypting the encrypted column and no code path reads from a plaintext column.
- Given the transitional backfill hosted services for these encrypted fields, when the application starts after this change, then those hosted services are no longer registered or executed, because the encrypted columns are already populated.
- Given the migration that drops a plaintext column, when it runs, then it drops the column only after the corresponding encrypted column exists and is backfilled for all rows, so no PII is lost by the drop (additive-safe sequencing consistent with the prior legacy-plaintext-drop migrations).
- Given equality lookups or uniqueness constraints that previously used a plaintext column (e.g. user email), when they execute after this change, then they use the hash column (e.g. `User.EmailHash`) and continue to behave correctly without scanning plaintext.
- Given the automated test suite, when it runs, then tests assert encrypted-only behaviour: the plaintext columns are absent from the model/schema, reads return the correct decrypted values, and no regression exposes plaintext PII.
- Given multi-condominium isolation and role-based rules, when the schema change is applied, then no cross-tenant data is exposed and existing access controls remain enforced.

## Traceability Note

`implementationRefs` and `testRefs` are intentionally empty at Draft status: the schema migration, entity/model edits, hosted-service removal, and tests are produced in the implementation stage. They must be populated (drop migration, updated `User`/`Condominium`/`Supplier`/`UsefulContact`/`Invoice` entities, encrypted-only repository/service reads, removed backfill hosted services, and the asserting tests) before this requirement moves to `Implemented`.

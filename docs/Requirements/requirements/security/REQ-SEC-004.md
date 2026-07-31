---
id: REQ-SEC-004
title: Users can request full or partial erasure/anonymization of personal data with legal-retention exceptions
type: Functional
module: Security
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-SEC-001
  - REQ-SEC-002
  - REQ-SEC-003
  - REQ-SEC-005
  - REQ-PAY-001
  - REQ-FIN-001
  - REQ-AUTH-006
  - REQ-USERS-003
designRefs:
  - docs/Requirements/diagrams/use-cases/gdpr-self-service.mmd
  - docs/Requirements/diagrams/classes/privacy-services.mmd
  - docs/Requirements/diagrams/sequences/gdpr-export-erasure.mmd
implementationRefs:
  - src/Habitus.Application/Interfaces/IPersonalDataService.cs
  - src/Habitus.Application/Interfaces/ErasureValidationException.cs
  - src/Habitus.Application/Services/PersonalDataService.cs
  - src/Habitus.Application/DTOs/PersonalData/ErasureDtos.cs
  - src/Habitus.Api/Controllers/MeController.cs
  - src/Habitus.Domain/Entities/User.cs
  - src/Habitus.Domain/Entities/PersonalDataRequest.cs
  - src/Habitus.Infrastructure/Migrations/20260731102744_AddPersonalDataErasure.cs
  - src/habitus-web/src/api/services.ts
  - src/habitus-web/src/types/index.ts
  - src/habitus-web/src/pages/ProfilePage.tsx
testRefs:
  - tests/Habitus.Api.IntegrationTests/PersonalDataErasureIntegrationTests.cs
  - tests/Habitus.Tests/PersonalDataServiceTests.cs
  - tests/Habitus.Tests/PersonalDataServiceIsolationTests.cs
---

# REQ-SEC-004

Authenticated users can request erasure of their personal data (GDPR / RGPD right to be forgotten, Art. 17), in either a full or a partial form. The system honours the Art. 17(3)(b) legal-retention exception by anonymizing/pseudonymizing direct identifiers on records that must be kept by law (financial, accounting/SAF-T, audit) instead of hard-deleting them, while preserving multi-condominium isolation and role rules.

## Full vs Partial Erasure

- **Full erasure (account deletion/anonymization):** the account is marked for deletion; direct identifiers (name, email, phone, address, external login links) are removed or replaced with pseudonymized/anonymized values; the account can no longer authenticate.
- **Partial erasure:** the account remains active and able to authenticate; only specific non-retained personal fields chosen by the user are removed, leaving the rest of the profile intact.

## Legal-Retention Exception (Art. 17(3)(b))

- Financial/accounting/invoice records and audit trails that must be retained by law are NOT hard-deleted. Instead, the direct identifiers on those records are anonymized/pseudonymized (e.g. the party's name becomes "Utilizador anonimizado" and the foreign-key link to the user is severed), while amounts, dates, and SAF-T-relevant fields are preserved unchanged.
- On full erasure, `UnitMembership` links and `User.UnitId` / `User.CondominiumId` associations are severed/anonymized so the person is no longer identifiable, but any retained financial record referencing that membership keeps its non-identifying accounting fields.

## Accountability & Sequencing

- The erasure request itself is recorded as an append-only entry consistent with the existing `UserConsent` history model (request type, timestamp, actor), so the action is auditable and never silently overwritten.
- A self-erasure flow requires an explicit confirmation step (strong confirmation or re-authentication) before the account is marked for deletion, because the change is irreversible and disables login.
- After full erasure/anonymization the subject cannot authenticate; this interacts with the mandatory-consent gate (HTTP 451) and active-context — an erased/anonymized user must not be able to reach consent-gated or context-scoped endpoints.

## Acceptance Criteria

- Given an authenticated user, when they confirm a full erasure request (with confirmation/re-authentication), then the account is marked for deletion, all direct identifiers (name, email, phone, address, external login links) are removed or replaced with anonymized values, and the account can no longer authenticate.
- Given an authenticated user, when they request partial erasure of specific non-retained fields, then only those fields are removed and the account remains active and able to authenticate.
- Given records that must be retained for legal or accounting reasons (financial/SAF-T/audit), when erasure is processed, then the record is preserved with its amounts, dates, and SAF-T-relevant fields intact while direct identifiers are replaced with anonymized/pseudonymized values (e.g. "Utilizador anonimizado") and the user link is severed.
- Given a user whose data was erased or anonymized, when the profile is viewed, then no plaintext personal data remains in any user-facing field.
- Given a full erasure, when it is processed, then the user's `UnitMembership` links and `User.UnitId`/`User.CondominiumId` associations are severed/anonymized, and no other tenant's records are altered or broken.
- Given a Manager, when they trigger erasure for a managed user, then only data within that Manager's authorized condominium scope is affected and no data outside that scope is erased or anonymized.
- Given any erasure request, when it is submitted, then an append-only record of the request (type, timestamp, actor) is stored consistently with the `UserConsent` history model.
- Given a user who has been fully erased/anonymized, when they attempt to authenticate or reach a consent-gated (HTTP 451) or context-scoped endpoint, then access is denied.

---
id: REQ-SEC-003
title: Users can export their personal data in a portable, machine-readable format
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
  - REQ-SEC-004
  - REQ-USERS-003
  - REQ-AUTH-006
  - REQ-PAY-001
  - REQ-FIN-001
designRefs:
  - docs/Requirements/diagrams/use-cases/gdpr-self-service.mmd
  - docs/Requirements/diagrams/classes/privacy-services.mmd
  - docs/Requirements/diagrams/sequences/gdpr-export-erasure.mmd
implementationRefs:
  - src/Habitus.Application/Interfaces/IPersonalDataService.cs
  - src/Habitus.Application/Services/PersonalDataService.cs
  - src/Habitus.Application/DTOs/PersonalData/PersonalDataExportDto.cs
  - src/Habitus.Api/Controllers/MeController.cs
  - src/Habitus.Domain/Entities/PersonalDataRequest.cs
  - src/Habitus.Api/Middleware/RequireMandatoryConsentFilter.cs
  - src/habitus-web/src/api/services.ts
  - src/habitus-web/src/pages/ProfilePage.tsx
testRefs:
  - tests/Habitus.Api.IntegrationTests/PersonalDataExportIntegrationTests.cs
  - tests/Habitus.Tests/PersonalDataServiceTests.cs
  - tests/Habitus.Tests/PersonalDataServiceIsolationTests.cs
---

# REQ-SEC-003

Authenticated users can request an export (portability) of their own personal data in a portable, structured, machine-readable format, limited to the condominiums where they hold membership and excluding any other user's or tenant's personal data. This realizes the GDPR / RGPD right to data portability (Art. 20).

## Export Format Decision

- The canonical export format is a single UTF-8 **JSON** document with a stable, documented schema (top-level `subject`, `profile`, `memberships`, `consents`, `records` object keyed by category, and an `exportMetadata` block with `generatedAt`, `subjectUserId`, and `condominiumScope`).
- A human-readable companion (PDF or HTML rendering of the same data) MAY be offered as an optional secondary artifact, but JSON is authoritative for portability.
- Encrypted PII fields (phone, address, and any other fields encrypted at rest per REQ-SEC-001) are decrypted to **plaintext** in the export because the data subject is the owner of that data.

## Data Categories Included

- Personal profile fields: name, email, phone, address, preferred language/localization, external login links (identifiers only, no secrets).
- Unit memberships (`UnitMembership`): unit, condominium, role, and membership dates for condominiums the subject belongs to.
- Consent history: all `UserConsent` records with the referenced `ConsentDefinition`, decision, and timestamps.
- Per-condominium records the subject owns or is party to, within their membership scope: their maintenance requests, their reservations, and payments/invoices where they are the payer/party.

## Data Categories Excluded

- Any personal data of other users or tenants, and any records outside the subject's authorized condominium scope.
- System/internal audit trails and security logs that are not personal data of the subject.
- Secrets and credentials (password hashes, tokens, webhook secrets, provider API keys).

## Security Handling

- The export endpoint requires an authenticated session for the subject (self-service) and is not reachable via any public or unauthenticated link.
- Export requests are rate-limited and each request is recorded in the audit log (who, when, scope) for accountability.

## Acceptance Criteria

- Given an authenticated user, when they request a data export, then the system returns a UTF-8 JSON document containing their profile, unit memberships, consent history, and their in-scope condominium records, with encrypted PII fields decrypted to plaintext.
- Given an authenticated user with memberships in condominiums A and B only, when they export their data, then only records from condominiums A and B are included and no record from any other condominium is present.
- Given an authenticated user, when the export is generated, then no other user's personal data and no secrets/credentials (password hashes, tokens, webhook secrets) appear anywhere in the export.
- Given a Manager, when they request an export for a user they manage, then the export contains only data from condominiums within that Manager's authorized scope and excludes that user's data in condominiums the Manager does not manage.
- Given an unauthenticated caller, when they attempt to reach the export endpoint, then the request is rejected with an authentication error and no data is produced.
- Given repeated export requests from the same subject beyond the configured limit, when the limit is exceeded, then the system rate-limits the request, and every accepted export request is written to the audit log with subject id, timestamp, and condominium scope.
- Given an export request, when it completes, then the JSON validates against the documented export schema (top-level `subject`, `profile`, `memberships`, `consents`, `records`, and `exportMetadata`).

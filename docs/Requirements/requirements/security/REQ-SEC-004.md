---
id: REQ-SEC-004
title: Users can request erasure or anonymization of personal data
type: Functional
module: Security
priority: High
status: Draft
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-SEC-001
  - REQ-SEC-002
  - REQ-SEC-003
  - REQ-INV-001
  - REQ-FIN-001
  - REQ-USERS-003
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/use-cases/gdpr-self-service.mmd
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/classes/privacy-services.mmd
implementationRefs: []
testRefs: []
---

# REQ-SEC-004

Authenticated users can request deletion or anonymization of personal data, while the system preserves legally required financial and audit records through retention rules and removes direct identifiers from active records where allowed.

## Acceptance Criteria

- Given an authenticated user, when they request erasure of their personal data, then the system marks the account for deletion or anonymization and removes non-retained personal fields.
- Given records that must be retained for legal or accounting reasons, when erasure is processed, then the system preserves the record while replacing direct identifiers with anonymized or pseudonymized values.
- Given a user whose data was erased or anonymized, when the profile is viewed, then no plaintext personal data remains in user-facing fields.

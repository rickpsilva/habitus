---
id: REQ-SEC-003
title: Users can export their personal data in a portable format
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
  - REQ-SEC-004
  - REQ-USERS-003
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/use-cases/gdpr-self-service.mmd
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/classes/privacy-services.mmd
implementationRefs: []
testRefs: []
---

# REQ-SEC-003

Authenticated users can request an export of their personal data in a portable format, limited to their authorized condominium scope and excluding other tenants' information.

## Acceptance Criteria

- Given an authenticated user, when they request a data export, then the system generates a portable export containing their personal profile and related condominium-scoped records.
- Given a Manager, when they request an export for a user they manage, then the export is limited to condominiums within that manager's scope.
- Given a user without permission to access another condominium, when they request export data outside their scope, then the system excludes that data from the export.

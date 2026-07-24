---
id: REQ-USERS-003
title: Personal area includes RGPD information and self-service privacy actions
type: Functional
module: Users
priority: High
status: Draft
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-005
  - REQ-SEC-003
  - REQ-SEC-004
  - REQ-USERS-002
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/use-cases/gdpr-self-service.mmd
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/first-login-rgpd-acceptance.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/habitus-web/src/pages/ProfilePage.tsx
  - /home/rick/workspace/habitus/src/habitus-web/src/components/Layout.tsx
  - /home/rick/workspace/habitus/src/habitus-web/src/App.tsx
testRefs: []
---

# REQ-USERS-003

The user personal area includes a GDPR section where the user can consult the site's RGPD information and trigger export or erasure requests for their own data.

## Acceptance Criteria

- Given an authenticated user, when they open the personal area, then a GDPR section is visible with the site's RGPD information.
- Given an authenticated user, when they request data export from the personal area, then the system starts the export flow limited to that user's scope.
- Given an authenticated user, when they request data erasure or anonymization from the personal area, then the system starts the privacy workflow and preserves legally required records.

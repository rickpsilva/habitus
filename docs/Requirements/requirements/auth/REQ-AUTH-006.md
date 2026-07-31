---
id: REQ-AUTH-006
title: Users with multiple memberships can select their active fraction and condominium
type: Functional
module: Auth
priority: High
status: Draft
roles:
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-AUTH-005
  - REQ-UNITS-002
  - REQ-UNITS-003
  - REQ-USERS-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/active-context-selection.mmd
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/data/user-unit-membership.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/habitus-web/src/pages/SelectCondominiumPage.tsx
testRefs: []
---

# REQ-AUTH-006

When a user is associated with more than one fraction and/or condominium, the portal lets the user choose the active fraction and condominium, and all subsequent data is scoped to that active context; users with a single membership skip the selection.

## Acceptance Criteria

- Given a user with more than one condominium and/or fraction, when they sign in, then the system presents a selector to choose the active condominium and fraction before loading the workspace.
- Given a user with exactly one membership, when they sign in, then the system adopts it as the active context without showing a selector.
- Given an active context, when the user reads or writes data, then results are scoped to the selected condominium and fraction only.
- Given an authenticated user, when they change the active context, then the switch takes effect without requiring a new login and re-scopes the whole portal.
- Given a selection request targeting a membership the user does not hold, when it is submitted, then the system rejects it.

---
id: REQ-SPACES-001
title: Shared spaces are configured per condominium
type: Functional
module: SharedSpaces
priority: Medium
status: Implemented
roles:
  - Manager
  - Admin
relatedRequirements:
  - REQ-RES-001
  - REQ-AUTH-001
designRefs:
  - docs/Requirements/diagrams/sequences/reservations-conflict-and-approval-flow.mmd
implementationRefs:
  - src/Habitus.Api/Controllers/SharedSpacesController.cs
testRefs: []
---

# REQ-SPACES-001

Each condominium can define and manage its own shared spaces so reservation availability and rules remain tenant-scoped.

## Acceptance Criteria

- Given an authorized condominium user, when a shared space is created, then it is associated with that condominium.
- Given a user from another condominium, when shared spaces are queried, then the records are not exposed.
- Given a shared space update, when it is saved, then the new data remains isolated to the same condominium.

---
id: REQ-AUTH-002
title: Public resident registration is available per condominium and requires approval
type: Functional
module: Auth
priority: High
status: Implemented
roles:
  - Admin
  - Resident
  - Manager
relatedRequirements:
  - REQ-AUTH-001
  - REQ-USERS-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/users-management-scope-flow.mmd
---

# REQ-AUTH-002

Public registration creates a pending Resident user for a specific condominium and unit, and activation requires approval by an Admin or an existing Resident.

## Acceptance Criteria

- Given a valid condominium and unit, when a public resident registration is submitted, then the system creates an inactive Resident user tied to that condominium.
- Given a pending registration, when an Admin or approved Resident confirms it, then the account becomes active.
- Given an invalid condominium, unit, or duplicate email, when registration is submitted, then the system rejects it.

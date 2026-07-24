---
id: REQ-USERS-001
title: Platform users can be managed with role and condominium constraints
type: Functional
module: Users
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-AUTH-002
  - REQ-AUTH-003
  - REQ-AUTH-005
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/users-management-scope-flow.mmd
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
---

# REQ-USERS-001

Managers can create, update, list, and delete users across condominiums, while Admins can do the same only inside their assigned condominium and cannot create Managers.

## Acceptance Criteria

- Given a Manager, when creating a user, then the request may target any condominium and any supported role.
- Given an Admin, when creating or editing a user, then the request is limited to the admin's condominium and cannot assign the Manager role.
- Given a Resident, when calling user management endpoints, then the system denies the operation.

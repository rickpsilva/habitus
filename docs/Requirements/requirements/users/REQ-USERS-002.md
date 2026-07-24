---
id: REQ-USERS-002
title: Users can manage their own profile and password
type: Functional
module: Users
priority: Medium
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-004
  - REQ-USERS-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/users-management-scope-flow.mmd
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
---

# REQ-USERS-002

Authenticated users can update their own contact data and password, but not their role, condominium, or unit assignment.

## Acceptance Criteria

- Given an authenticated user, when they edit their profile, then only allowed personal fields are persisted.
- Given an authenticated user, when they change their password with the correct current password, then the new password is stored and the old one stops working.
- Given a profile update that attempts to change role, condominium, or unit, then the system ignores or rejects those fields.

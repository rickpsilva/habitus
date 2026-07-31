---
id: REQ-AUTH-003
title: Authentication responses include role and condominium scope claims
type: Functional
module: Auth
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-USERS-001
designRefs:
  - docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
---

# REQ-AUTH-003

Login and registration responses expose the authenticated user's role and scope so the frontend and API can enforce condominium and unit boundaries consistently.

## Acceptance Criteria

- Given a successful login, when the response is returned, then it contains the JWT token, role, condominiumId, and unitId fields.
- Given a Manager account, when the response is returned, then condominiumId and unitId are null.
- Given an authenticated user, when the token is decoded, then the role and scope claims match the user record stored in the database.

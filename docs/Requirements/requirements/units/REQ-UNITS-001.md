---
id: REQ-UNITS-001
title: Condominium units are managed within condominium scope
type: Functional
module: Units
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-USERS-001
  - REQ-CONDO-001
designRefs:
  - docs/Requirements/diagrams/sequences/units-management-scope-flow.mmd
  - docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
---

# REQ-UNITS-001

Managers and Admins can create, update, list, and delete units within the condominiums they are allowed to manage, and Residents remain tied to an assigned unit.

## Acceptance Criteria

- Given a Manager, when creating a unit, then the manager can choose any condominium they manage.
- Given an Admin, when creating a unit, then the unit is created only in the admin's condominium.
- Given a Resident or Admin accessing a foreign condominium, then the system rejects the request.

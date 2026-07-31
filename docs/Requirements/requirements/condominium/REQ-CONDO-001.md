---
id: REQ-CONDO-001
title: Managers can create and maintain condominiums
type: Functional
module: Condominium
priority: High
status: Implemented
roles:
  - Manager
relatedRequirements:
  - REQ-AUTH-001
  - REQ-USERS-001
designRefs:
  - docs/Requirements/diagrams/sequences/condominium-management-flow.mmd
  - docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
---

# REQ-CONDO-001

Managers can create, update, activate, deactivate, and delete condominiums, while non-manager roles cannot manage condominium records.

## Acceptance Criteria

- Given a Manager, when a condominium creation request is submitted, then the system creates a new active condominium.
- Given a non-Manager, when a condominium management endpoint is called, then the system rejects the request.
- Given a condominium with dependent records, when delete is attempted, then the system prevents data loss or surfaces the dependency error.

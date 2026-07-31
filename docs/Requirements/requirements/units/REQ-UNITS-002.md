---
id: REQ-UNITS-002
title: A resident or internal admin can own multiple fractions within a condominium
type: Functional
module: Units
priority: High
status: Draft
roles:
  - Admin
  - Resident
relatedRequirements:
  - REQ-UNITS-001
  - REQ-UNITS-003
  - REQ-AUTH-006
  - REQ-USERS-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/data/user-unit-membership.mmd
implementationRefs: []
testRefs: []
---

# REQ-UNITS-002

A resident or internal admin can be associated as owner/occupant of more than one fraction (unit) inside the same condominium, replacing the current single-unit assignment with a many-to-many membership while preserving condominium isolation.

## Acceptance Criteria

- Given a resident or internal admin, when they are linked to two or more units of the same condominium, then all those memberships are persisted and visible without overwriting each other.
- Given a user with multiple fractions in a condominium, when condominium-scoped data (quotas, payments, documents) is listed, then the data is aggregated or filtered by the fractions the user actually owns in that condominium.
- Given a membership create/update request, when it targets a unit outside the user's authorized condominium, then the system rejects the request and preserves multi-condominium isolation.
- Given a user with several fractions, when exactly one is flagged as primary, then the system uses it as the default fraction for that condominium.

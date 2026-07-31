---
id: REQ-AUTH-006
title: Users with multiple memberships can select their active fraction and condominium
type: Functional
module: Auth
priority: High
status: Implemented
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
  - docs/Requirements/diagrams/sequences/active-context-selection.mmd
  - docs/Requirements/diagrams/data/user-unit-membership.mmd
implementationRefs:
  - src/Habitus.Domain/Entities/UnitMembership.cs
  - src/Habitus.Application/Services/UnitMembershipService.cs
  - src/Habitus.Api/Controllers/MeController.cs
  - src/habitus-web/src/pages/SelectContextPage.tsx
  - src/habitus-web/src/contexts/AuthContext.tsx
  - src/habitus-web/src/components/Layout.tsx
testRefs:
  - tests/Habitus.Api.IntegrationTests/MeContextIntegrationTests.cs
  - tests/Habitus.Tests/UnitMembershipServiceIsolationTests.cs
  - tests/Habitus.Tests/AuthServiceTests.cs
---

# REQ-AUTH-006

When a user is associated with more than one fraction and/or condominium, the portal lets the user choose the active fraction and condominium, and all subsequent data is scoped to that active context; users with a single membership skip the selection.

## Acceptance Criteria

- Given a user with more than one condominium and/or fraction, when they sign in, then the system presents a selector to choose the active condominium and fraction before loading the workspace.
- Given a user with exactly one membership, when they sign in, then the system adopts it as the active context without showing a selector.
- Given an active context, when the user reads or writes data, then results are scoped to the selected condominium and fraction only.
- Given an authenticated user, when they change the active context, then the switch takes effect without requiring a new login and re-scopes the whole portal.
- Given a selection request targeting a membership the user does not hold, when it is submitted, then the system rejects it.

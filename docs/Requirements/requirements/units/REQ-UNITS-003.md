---
id: REQ-UNITS-003
title: A resident or internal admin can hold fractions across multiple condominiums
type: Functional
module: Units
priority: High
status: Implemented
roles:
  - Admin
  - Resident
relatedRequirements:
  - REQ-UNITS-001
  - REQ-UNITS-002
  - REQ-AUTH-006
  - REQ-CONDO-001
designRefs:
  - docs/Requirements/diagrams/data/user-unit-membership.mmd
implementationRefs:
  - src/Habitus.Domain/Entities/UnitMembership.cs
  - src/Habitus.Application/Services/UnitMembershipService.cs
  - src/Habitus.Application/DTOs/Memberships/UnitMembershipDto.cs
  - src/Habitus.Infrastructure/Data/HabitusDbContext.cs
  - src/Habitus.Infrastructure/Migrations/20260730010225_AddUnitMembership.cs
  - src/Habitus.Api/Controllers/MeController.cs
testRefs:
  - tests/Habitus.Tests/UnitMembershipServiceIsolationTests.cs
  - tests/Habitus.Api.IntegrationTests/MeContextIntegrationTests.cs
---

# REQ-UNITS-003

A resident or internal admin can own fractions in more than one condominium, each membership being scoped to its own condominium, so that data from one condominium is never mixed with, or exposed to, another.

## Acceptance Criteria

- Given a user linked to fractions in condominium A and condominium B, when both memberships exist, then each is stored independently with its own condominium scope.
- Given a user active in condominium A, when they read or write condominium-scoped data, then only condominium A data is returned and condominium B data stays inaccessible.
- Given an internal admin with memberships in two condominiums, when acting in one condominium, then the admin's role permissions apply only to the active condominium and not to the other.
- Given a user with no membership in a condominium, when they request that condominium's data, then the system denies access.

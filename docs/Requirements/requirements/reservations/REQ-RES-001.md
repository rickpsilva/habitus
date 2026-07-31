---
id: REQ-RES-001
title: Shared-space reservations prevent conflicting bookings
type: Functional
module: Reservations
priority: High
status: Implemented
roles:
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-SPACES-001
designRefs:
  - docs/Requirements/diagrams/sequences/reservations-conflict-and-approval-flow.mmd
implementationRefs:
  - src/Habitus.Api/Controllers/ReservationsController.cs
  - src/Habitus.Application/Services/ReservationService.cs
testRefs:
  - tests/Habitus.Tests/ReservationServiceTests.cs
  - tests/Habitus.Tests/ReservationServiceIsolationTests.cs
---

# REQ-RES-001

Reservation creation and updates reject overlapping bookings for the same shared space and condominium time window.

## Acceptance Criteria

- Given a shared space and time slot, when a conflicting reservation is created, then the system rejects it.
- Given a valid time slot, when a reservation is created, then it is saved under the caller's condominium.
- Given a user outside the condominium, when they request the reservation, then the system denies access.

---
id: REQ-POLL-004
title: Server-side role enforcement, double-voting prevention, and vote auditability
type: Non-Functional
module: Polls
priority: Medium
status: Draft
roles:
  - Admin
  - Resident
relatedRequirements:
  - REQ-POLL-001
  - REQ-POLL-002
  - REQ-POLL-003
designRefs: []
implementationRefs:
  - src/Habitus.Application/Services/PollService.cs
  - src/Habitus.Api/Middleware/RequireFeatureAttribute.cs
  - src/Habitus.Infrastructure/Data/HabitusDbContext.cs
testRefs:
  - tests/Habitus.Tests/PollServiceTests.cs
---

# REQ-POLL-004

All poll operations must be enforced server-side: only the announcement author or a condominium administrator manages a poll add-on, add-on CRUD is locked once the announcement is Published or Archived, only residents of the owning condominium vote on published announcements, double-voting is impossible even under concurrent requests, and votes are auditable.

> Note: `implementationRefs` and `testRefs` were populated by the backend/frontend implementation and test & validation stages (2026-08-25). `designRefs` are covered by the diagrams listed in `catalog-manifest.json`.

## Acceptance Criteria

- Given any poll endpoint, when invoked, then role, publication-state and condominium-membership checks happen server-side; client-side checks are convenience only and bypassing them has no effect.
- Given a create/update/delete attempt on a poll whose announcement is Published or Archived, when sent by anyone (including Admins), then the API refuses it — published add-ons are immutable.
- Given concurrent duplicate vote submissions from the same resident for the same poll, when processed, then exactly one vote is stored (atomic uniqueness at the persistence layer).
- Given a stored vote, when inspected for audit purposes, then it persists voter identity, poll identifier, option identifier, and timestamp, and these audit fields are immutable.
- Given adversarial requests with forged identifiers or cross-condominium references, when sent to create/vote/results endpoints, then multi-condominium isolation still holds.

## Quality Criteria

- Integration test issuing parallel duplicate votes yields a single record.
- Authorization-matrix tests: Admin creates; Resident votes; other roles/outsiders refused.
- Audit fields present and non-null on every persisted vote.

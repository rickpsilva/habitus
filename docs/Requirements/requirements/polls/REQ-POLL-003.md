---
id: REQ-POLL-003
title: Poll results show per-option counts and closed polls become read-only
type: Functional
module: Polls
priority: Medium
status: Draft
roles:
  - Resident
  - Admin
relatedRequirements:
  - REQ-POLL-001
  - REQ-POLL-002
designRefs: []
implementationRefs:
  - src/Habitus.Application/Services/PollService.cs
testRefs:
  - tests/Habitus.Tests/PollServiceTests.cs
---

# REQ-POLL-003

Poll results are visible as aggregated counts per vote option after a resident has voted, and final results remain visible after the poll closes. Closed polls become read-only: no further votes are accepted once the closing date has passed.

> Note: `implementationRefs` and `testRefs` were populated by the backend/frontend implementation and test & validation stages (2026-08-25). `designRefs` are covered by the diagrams listed in `catalog-manifest.json`.

## Acceptance Criteria

- Given a resident who has voted in an active poll, when they view the poll, then they see the aggregated vote count per option.
- Given a poll that has passed its closing date, when an authorized user of the condominium views it, then final per-option totals are shown and it accepts no new votes (read-only).
- Given results data for any poll, when returned to regular users, then it exposes aggregate counts per option only, never individual voter choices.
- Given a poll in another condominium, when a user requests its results, then the API refuses or hides them (multi-condominium isolation).

## Quality Criteria

- Reported per-option totals equal the sum of recorded votes (integrity check in tests).
- Read-only enforcement is tested after the closing date passes (vote attempts rejected).

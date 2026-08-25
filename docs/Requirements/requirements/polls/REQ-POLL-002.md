---
id: REQ-POLL-002
title: Residents vote once on active polls of their condominium
type: Functional
module: Polls
priority: High
status: Draft
roles:
  - Resident
relatedRequirements:
  - REQ-POLL-001
  - REQ-ANN-001
  - REQ-AUTH-001
designRefs: []
implementationRefs:
  - src/Habitus.Application/Services/PollService.cs
  - src/Habitus.Domain/Entities/PollVote.cs
  - src/Habitus.Infrastructure/Data/HabitusDbContext.cs
testRefs:
  - tests/Habitus.Tests/PollServiceTests.cs
---

# REQ-POLL-002

Residents of a condominium can cast one vote on an active poll of their own condominium, but only while the linked announcement is Published and the poll's closing date has not passed. Each vote is recorded per user; only one vote per resident per poll is allowed.

> Note: `implementationRefs` and `testRefs` were populated by the backend/frontend implementation and test & validation stages (2026-08-25). `designRefs` are covered by the diagrams listed in `catalog-manifest.json`.

## Acceptance Criteria

- Given a published poll whose closing date has not passed in the resident's condominium, when the resident submits a vote selecting one of the poll options, then the vote is recorded with the resident identity, poll, selected option, and timestamp.
- Given a resident who already voted in a poll, when they attempt to vote again in the same poll, then the API rejects the second vote (HTTP 409) and the original vote remains unchanged.
- Given a poll whose announcement is not Published, or whose closing date has passed, or that was manually closed, when a resident attempts to vote, then the API rejects the vote.
- Given a user with no residency in the poll's condominium, when they attempt to vote, then the API refuses and no vote is recorded (multi-condominium isolation).
- Given a vote submission referencing a nonexistent option or an option of another poll, when submitted, then the API rejects it with HTTP 400.

## Quality Criteria

- Tests cover one-vote-per-resident, including concurrent duplicate submissions producing exactly one stored vote.
- Isolation tests prove cross-condominium vote attempts fail.
- Vote records remain attributable per user (per-user vote rows persisted).

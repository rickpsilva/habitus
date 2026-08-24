---
id: REQ-POLL-001
title: Administrator creates a poll with description, vote options, and mandatory expiration
type: Functional
module: Polls
priority: High
status: Draft
roles:
  - Admin
relatedRequirements:
  - REQ-ANN-001
  - REQ-ANN-002
designRefs: []
implementationRefs:
  - src/Habitus.Api/Controllers/PollsController.cs
  - src/Habitus.Application/Services/PollService.cs
testRefs:
  - tests/Habitus.Tests/PollServiceTests.cs
---

# REQ-POLL-001

A condominium administrator creates a poll vote linked to an announcement of the same condominium. A poll must have a description, at least two distinct vote options, and a mandatory expiration date/time. All residents of the condominium are invited to vote through the linked announcement.

> Note: `implementationRefs` and `testRefs` were populated by the backend/frontend implementation and test & validation stages (2026-08-25). `designRefs` are covered by the diagrams listed in `catalog-manifest.json`.

## Acceptance Criteria

- Given an authenticated Admin of a condominium, when they create a poll with a description, at least two distinct vote options, and a future expiration date/time, linked to an existing announcement of the same condominium, then the poll is created and associated with that announcement and condominium.
- Given a poll creation request without an expiration date/time, when submitted, then the API rejects it with HTTP 400 and a clear error message.
- Given a poll creation request without an announcement link, when submitted, then the API rejects it with HTTP 400 — every poll must be anchored to an announcement so residents find it where they read communications.
- Given a poll creation request with an expiration date/time in the past, when submitted, then the API rejects it with HTTP 400 (consistent with REQ-ANN-002 expiration semantics).
- Given a poll creation request with fewer than two distinct vote options, when submitted, then the API rejects it with HTTP 400.
- Given an authenticated user who is not an Admin of the target condominium, when attempting to create a poll, then the API refuses the operation and no poll is created.
- Given an announcement that belongs to a different condominium, when an Admin tries to link a poll to it, then the operation is refused (multi-condominium isolation).
- Given a successfully created poll, when residents of the condominium view the linked announcement, then the poll is offered to every resident of that condominium for voting.

## Quality Criteria

- Unit tests cover description, announcement-link, option-count, and expiration validation.
- Integration tests cover creation authorization and cross-condominium linkage refusal.
- Error messages are clear and localized (pt-PT/en).

---
id: REQ-POLL-001
title: Admins and Residents create polls as announcement add-ons with a closing date
type: Functional
module: Polls
priority: High
status: Draft
roles:
  - Admin
  - Resident
relatedRequirements:
  - REQ-ANN-001
  - REQ-ANN-002
designRefs:
  - docs/Requirements/diagrams/data/poll-vote-er.mmd
implementationRefs:
  - src/Habitus.Api/Controllers/PollsController.cs
  - src/Habitus.Application/Services/PollService.cs
  - src/habitus-web/src/components/AnnouncementPollAddon.tsx
testRefs:
  - tests/Habitus.Tests/PollServiceTests.cs
---

# REQ-POLL-001

Poll votes are add-ons of announcements. Both Admins and Residents can attach a poll to an announcement they are authoring or editing, exactly like creating an announcement itself. While the announcement is not yet published (Draft, PendingApproval, Rejected), the poll add-on can be added, edited, or removed. A poll must have a description, at least two distinct vote options, and a mandatory closing date/time in the future; after the closing date no user can vote anymore.

> Note: `implementationRefs` and `testRefs` were populated by the backend/frontend implementation and test & validation stages. `designRefs` are covered by the diagrams listed in `catalog-manifest.json`.

## Acceptance Criteria

- Given an authenticated Admin or Resident authoring a new announcement, when they enable the "poll" add-on with a description, at least two distinct vote options, and a future closing date/time, then the poll is created linked to that announcement and condominium.
- Given an announcement still unpublished (Draft, PendingApproval, or Rejected), when its author or a condominium Admin edits or removes its poll add-on, then the change is applied.
- Given an announcement already Published or Archived, when anyone attempts to create, edit, or remove its poll add-on, then the API refuses the operation.
- Given a poll creation/update without a closing date or with a past closing date, when submitted, then the API rejects it with HTTP 400.
- Given a poll creation/update with fewer than two distinct vote options, when submitted, then the API rejects it with HTTP 400.
- Given a poll request with no linked announcement, when submitted, then the API rejects it with HTTP 400 — every poll is anchored to an announcement.
- Given a user who is neither the announcement author nor a condominium Admin, when attempting to manage that announcement's poll add-on, then the operation is refused.
- Given an announcement that belongs to a different condominium, when linking a poll to it, then the operation is refused (multi-condominium isolation).
- After the closing date has passed, no user can cast further votes on the poll.

## Quality Criteria

- Unit tests cover description, announcement-link, option-count, and closing-date validation, plus the publication-state CRUD lock.
- Integration tests cover creation authorization (Admin and Resident authors) and cross-condominium linkage refusal.
- Error messages are clear and localized (pt-PT/en).


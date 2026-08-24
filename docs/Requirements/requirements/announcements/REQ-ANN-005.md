---
id: REQ-ANN-005
title: Archived announcements reject new comments
type: Functional
module: Announcements
priority: High
status: Planned
roles:
  - Admin
  - Manager
  - Resident
relatedRequirements:
  - REQ-ANN-001
  - REQ-ANN-004
designRefs:
  - docs/Requirements/diagrams/use-cases/announcement-lifecycle.mmd
implementationRefs:
  - src/Habitus.Api/Controllers/AnnouncementsController.cs
  - src/habitus-web/src/pages/AnnouncementsPage.tsx
testRefs:
  - tests/Habitus.Api.IntegrationTests/AnnouncementsIntegrationTests.cs
---

# REQ-ANN-005

Archived announcements must not accept new comments. The API must reject comment creation on archived announcements, and the UI must hide/disable the comment input for archived announcements.

## Acceptance Criteria

- Given an announcement with Status = Archived, when any user attempts to add a comment via POST /api/condominiums/{condominiumId}/announcements/{id}/comments, then the API returns HTTP 400 with error message "Não é possível comentar em comunicados arquivados" (or equivalent translated message).
- Given an announcement with Status = Archived, when the announcement detail view is displayed, then the comment input area is hidden or disabled with a visual indication that commenting is not allowed for archived announcements.
- Given an announcement with Status = Published (or other non-archived statuses where comments are allowed), when a user adds a comment, then the comment is accepted per existing rules.
- The existing check for `announcement.Status != AnnouncementStatus.Published` in the comments endpoint is extended to also reject `AnnouncementStatus.Archived`.

## Quality Criteria

- Integration test: POST comment on Archived announcement returns 400.
- Integration test: POST comment on Published announcement still works.
- UI test: comment form not rendered for Archived announcements.
- No regression on existing comment functionality for non-archived announcements.
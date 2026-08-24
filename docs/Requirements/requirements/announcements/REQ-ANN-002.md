---
id: REQ-ANN-002
title: Expiration date validation - must be current or future date
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
  - REQ-ANN-005
designRefs:
  - docs/Requirements/diagrams/use-cases/announcement-lifecycle.mmd
implementationRefs:
  - src/Habitus.Application/Validators/AnnouncementValidators.cs (new)
  - src/Habitus.Api/Controllers/AnnouncementsController.cs
  - src/habitus-web/src/pages/AnnouncementsPage.tsx
testRefs:
  - tests/Habitus.Api.IntegrationTests/AnnouncementsIntegrationTests.cs
---

# REQ-ANN-002

The expiration date (ValidUntil) must not be a date/time in the past. Validation must occur server-side (mandatory) with a clear error message; client-side validation is nice-to-have.

## Acceptance Criteria

- Given an authorized user creating or updating an announcement, when they provide a ValidUntil value that is before the current date/time, then the API returns HTTP 400 with error message "A data de expiração não pode ser anterior à data atual" (or equivalent translated message).
- Given an authorized user, when they provide a ValidUntil value equal to or after the current date/time, then the request is accepted (subject to other validations).
- Given an authorized user, when ValidUntil is null/omitted, then the request is accepted (expiration is optional).
- Server-side validation is mandatory; client-side validation prevents unnecessary round-trips.

## Quality Criteria

- Unit test for validator rejecting past dates.
- Integration test for Create endpoint rejecting past ValidUntil.
- Integration test for Update endpoint rejecting past ValidUntil.
- Error message is clear and localized.
---
id: REQ-ANN-001
title: Announcements support attachments, comments, and read tracking
type: Functional
module: Announcements
priority: Medium
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-DOC-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/notifications-dispatch-flow.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/AnnouncementsController.cs
testRefs:
  - /home/rick/workspace/habitus/tests/Habitus.Tests/NotificationDispatchServiceTests.cs
---

# REQ-ANN-001

Announcements are created within a condominium and support attachments, comments, and per-user read status tracking.

## Acceptance Criteria

- Given an authorized user, when an announcement is published, then it is stored for the condominium audience.
- Given a user who reads an announcement, when the read status is saved, then the announcement is marked as read for that user.
- Given comments or attachments, when they are added, then they remain associated with the same announcement and condominium.

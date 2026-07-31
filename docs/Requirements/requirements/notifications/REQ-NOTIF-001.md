---
id: REQ-NOTIF-001
title: Notifications are targeted by role and condominium scope
type: Functional
module: Notifications
priority: Medium
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
designRefs:
  - docs/Requirements/diagrams/sequences/notifications-dispatch-flow.mmd
implementationRefs:
  - src/Habitus.Api/Controllers/NotificationsController.cs
  - src/Habitus.Application/Services/NotificationDispatchService.cs
testRefs:
  - tests/Habitus.Tests/NotificationDispatchServiceTests.cs
---

# REQ-NOTIF-001

Notifications are delivered only to the intended role or user scope and must not leak condominium notifications to Manager accounts unless explicitly targeted.

## Acceptance Criteria

- Given a notification targeted at a condominium, when a user outside the condominium requests it, then it is not returned.
- Given a Manager, when the notification feed is loaded, then only manager-targeted notifications appear unless a message is explicitly addressed to that manager.
- Given a Resident or Admin, when a condo notification is created, then it is visible only to users in the same condominium scope.

---
id: REQ-MAINT-001
title: Maintenance requests support photos, location, and confirmation workflow
type: Functional
module: Maintenance
priority: High
status: Implemented
roles:
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-DOC-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/maintenance-expense-and-notification-flow.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/MaintenanceController.cs
  - /home/rick/workspace/habitus/src/Habitus.Application/Services/MaintenanceService.cs
testRefs:
  - /home/rick/workspace/habitus/tests/Habitus.Tests/MaintenanceServiceIsolationTests.cs
  - /home/rick/workspace/habitus/tests/Habitus.Tests/MaintenanceServiceTests.cs
---

# REQ-MAINT-001

Maintenance requests capture condominium scope, photos, location details, and confirmation state so Admins and Residents can track the lifecycle of each request.

## Acceptance Criteria

- Given an Admin or Resident, when a maintenance request is created, then it can include location information and attachments.
- Given an existing request, when another resident confirms it, then the confirmation state is updated and preserved.
- Given a request outside the user's condominium, then the system rejects or hides it.

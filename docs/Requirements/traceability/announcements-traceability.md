# Traceability Matrix - Announcements Module

This file tracks requirement → design → implementation → test traceability for REQ-ANN-001 through REQ-ANN-005.

| Requirement ID | Title | Design Refs | Implementation Refs | Test Refs | Status |
|---|---|---|---|---|---|
| REQ-ANN-001 | Expiration date field in create/edit forms | docs/Requirements/diagrams/use-cases/announcement-lifecycle.mmd | src/Habitus.Application/DTOs/Announcements/AnnouncementRequests.cs<br>src/Habitus.Api/Controllers/AnnouncementsController.cs<br>src/habitus-web/src/pages/AnnouncementsPage.tsx | tests/Habitus.Api.IntegrationTests/AnnouncementsIntegrationTests.cs | Planned |
| REQ-ANN-002 | Expiration date validation (>= now) | docs/Requirements/diagrams/use-cases/announcement-lifecycle.mmd | src/Habitus.Application/Validators/AnnouncementValidators.cs<br>src/Habitus.Api/Controllers/AnnouncementsController.cs<br>src/habitus-web/src/pages/AnnouncementsPage.tsx | tests/Habitus.Api.IntegrationTests/AnnouncementsIntegrationTests.cs | Planned |
| REQ-ANN-003 | Default status filter = Published | docs/Requirements/diagrams/use-cases/announcement-lifecycle.mmd | src/habitus-web/src/pages/AnnouncementsPage.tsx | tests/Habitus.Api.IntegrationTests/AnnouncementsIntegrationTests.cs | Planned |
| REQ-ANN-004 | Background job archives expired announcements | docs/Requirements/diagrams/use-cases/announcement-lifecycle.mmd | src/Habitus.Infrastructure/Services/AnnouncementExpiryBackgroundService.cs<br>src/Habitus.Infrastructure/DependencyInjection.cs<br>src/Habitus.Api/Program.cs<br>src/Habitus.Application/Interfaces/IAnnouncementService.cs | tests/Habitus.Tests/AnnouncementExpiryBackgroundServiceTests.cs | Planned |
| REQ-ANN-005 | Archived announcements reject comments | docs/Requirements/diagrams/use-cases/announcement-lifecycle.mmd | src/Habitus.Api/Controllers/AnnouncementsController.cs<br>src/habitus-web/src/pages/AnnouncementsPage.tsx | tests/Habitus.Api.IntegrationTests/AnnouncementsIntegrationTests.cs | Planned |

## Legend
- **Planned**: Requirements documented, implementation not started
- **In Progress**: Implementation started
- **Implemented**: Code complete, tests passing
- **Verified**: End-to-end validation passed
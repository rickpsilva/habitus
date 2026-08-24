---
id: REQ-ANN-004
title: Automatic background job archives expired announcements
type: Functional
module: Announcements
priority: High
status: Planned
roles:
  - System
relatedRequirements:
  - REQ-ANN-001
  - REQ-ANN-002
  - REQ-ANN-005
designRefs:
  - docs/Requirements/diagrams/use-cases/announcement-lifecycle.mmd
implementationRefs:
  - src/Habitus.Infrastructure/Services/AnnouncementExpiryBackgroundService.cs (new)
  - src/Habitus.Infrastructure/DependencyInjection.cs
  - src/Habitus.Api/Program.cs
  - src/Habitus.Application/Interfaces/IAnnouncementService.cs (new method)
testRefs:
  - tests/Habitus.Tests/AnnouncementExpiryBackgroundServiceTests.cs (new)
---

# REQ-ANN-004

An automatic background job (mirroring the existing `InvoiceGenerationBackgroundService` pattern) periodically archives announcements whose `ValidUntil` date has passed.

## Acceptance Criteria

- A new hosted service `AnnouncementExpiryBackgroundService` is registered in DI and runs on a configurable interval (default: daily at a sensible hour, e.g., 03:00 AM).
- The job queries all announcements per condominium where `ValidUntil` is not null, `ValidUntil < DateTime.UtcNow`, and `Status == Published` (or `PendingApproval`? — only Published makes sense for expiry).
- For each matching announcement, the job sets `Status = Archived` and `UpdatedAt = DateTime.UtcNow`.
- The job is idempotent: running multiple times does not double-archive or cause errors.
- The job respects multi-condominium scope: processes each condominium's announcements independently.
- The job logs: number of announcements archived per condominium, any errors.
- Configuration via `appsettings.json` section `Announcements:ExpiryJob` with properties `Enabled` (bool, default true), `RunTime` (time of day, default "03:00"), `IntervalHours` (default 24).
- The job can be disabled via configuration for testing/maintenance.

## Quality Criteria

- Unit test for the service's core logic (mock repository, verify status change).
- Integration test verifying expired announcements become Archived after job runs.
- Job follows the exact same pattern as `InvoiceGenerationBackgroundService` (BackgroundService, IServiceProvider scope, structured logging, cancellation token handling).
- No performance regression: job uses efficient query (index on ValidUntil + Status + CondominiumId recommended).
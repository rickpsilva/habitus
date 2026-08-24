---
id: REQ-ANN-003
title: Default status filter on announcements list is Published
type: Functional
module: Announcements
priority: Medium
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
  - src/habitus-web/src/pages/AnnouncementsPage.tsx
testRefs:
  - tests/Habitus.Api.IntegrationTests/AnnouncementsIntegrationTests.cs
---

# REQ-ANN-003

The announcements list page must default to filtering by "Publicado" (Published) status instead of "Todos" (All). Users can still select "Todos" or other statuses explicitly.

## Acceptance Criteria

- Given a user navigating to the announcements page, when the page loads without a status query parameter, then the status filter dropdown shows "Publicado" as selected and only published announcements are displayed (respecting visibility rules).
- Given a user explicitly selects "Todos" from the status filter dropdown, then all announcements visible to the user (per role-based visibility) are displayed.
- Given a user selects another status (e.g., "Rascunho", "Aguardando aprovação", "Rejeitado", "Arquivado"), then the list filters accordingly.
- The URL query parameter `status` reflects the selected filter (empty when "Publicado" is default, "All" when "Todos" is selected, or the status enum value).

## Quality Criteria

- Default filter is "Publicado" on initial page load.
- "Todos" option remains available and functional.
- URL sync works correctly for all filter values.
- No breaking change to existing direct links with explicit status parameters.
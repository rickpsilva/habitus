---
id: REQ-USERS-003
title: Personal area hosts RGPD information and self-service export/erasure actions
type: Functional
module: Users
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-005
  - REQ-SEC-003
  - REQ-SEC-004
  - REQ-SEC-005
  - REQ-USERS-002
designRefs:
  - docs/Requirements/diagrams/use-cases/gdpr-self-service.mmd
  - docs/Requirements/diagrams/sequences/first-login-rgpd-acceptance.mmd
  - docs/Requirements/diagrams/sequences/gdpr-export-erasure.mmd
implementationRefs:
  - src/habitus-web/src/pages/ProfilePage.tsx
  - src/habitus-web/src/pages/ConsentRequiredPage.tsx
  - src/habitus-web/src/api/services.ts
  - src/Habitus.Api/Controllers/MeController.cs
  - src/Habitus.Application/Services/PersonalDataService.cs
  - src/Habitus.Application/Services/ConsentService.cs
testRefs:
  - tests/Habitus.Api.IntegrationTests/PersonalDataExportIntegrationTests.cs
  - tests/Habitus.Api.IntegrationTests/PersonalDataErasureIntegrationTests.cs
  - tests/Habitus.Tests/PersonalDataServiceTests.cs
---

# REQ-USERS-003

The authenticated user's personal area exposes a GDPR / RGPD section where the user can read the site's RGPD information and start self-service export (REQ-SEC-003) and erasure/anonymization (REQ-SEC-004) actions for their own data, scoped to the condominiums where they hold membership.

## Scope and Behaviour

- The GDPR section is a distinct surface in the personal area, separate from the existing consent management (accept/withdraw) already offered in the Privacy tab.
- The export action starts the portability flow for the authenticated user only, restricted to their membership scope (delegates to REQ-SEC-003).
- The erasure action starts the right-to-be-forgotten flow with an explicit confirmation step and honours legal-retention exceptions (delegates to REQ-SEC-004).
- Actions offered here operate on the authenticated user's own personal data only; no other user's data is reachable from this surface.

## Out of Scope

- The `Download`/`Trash2` controls used elsewhere in the personal area for unit documents are unrelated to personal-data export/erasure and are not part of this requirement.

## Acceptance Criteria

- Given an authenticated user, when they open the personal area, then a GDPR section is visible showing the site's RGPD information and the export and erasure actions.
- Given an authenticated user, when they trigger data export from the GDPR section, then the export flow of REQ-SEC-003 is started for that user, scoped to their memberships only.
- Given an authenticated user, when they trigger data erasure/anonymization from the GDPR section, then the erasure flow of REQ-SEC-004 is started, requiring explicit confirmation before the account is marked for deletion.
- Given an authenticated user, when they use the GDPR section, then only that user's own personal data can be exported or erased and no cross-user or cross-condominium data is reachable.
- Given the personal area, when the GDPR section is rendered, then it is distinct from the consent accept/withdraw controls and does not reuse the unit-document `Download`/`Trash2` actions.

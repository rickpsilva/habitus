---
id: REQ-SEC-005
title: Users can view and manage RGPD consent from their personal area
type: Functional
module: Security
priority: High
status: Draft
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-005
  - REQ-USERS-003
  - REQ-SEC-003
  - REQ-SEC-004
  - REQ-SEC-006
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/cookie-and-rgpd-consent.mmd
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/use-cases/gdpr-self-service.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/Habitus.Domain/Entities/ConsentDefinition.cs
  - /home/rick/workspace/habitus/src/Habitus.Domain/Entities/UserConsent.cs
  - /home/rick/workspace/habitus/src/Habitus.Application/Services/ConsentService.cs
  - /home/rick/workspace/habitus/src/Habitus.Application/Interfaces/IConsentService.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/MeController.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Middleware/RequireMandatoryConsentFilter.cs
testRefs:
  - /home/rick/workspace/habitus/tests/Habitus.Tests/ConsentServiceTests.cs
  - /home/rick/workspace/habitus/tests/Habitus.Api.IntegrationTests/ConsentGateIntegrationTests.cs
---

# REQ-SEC-005

From the personal area, a user can read the current RGPD terms, see whether they have accepted them, and grant or withdraw consent; withdrawing a consent that is mandatory to operate the portal blocks further operation until it is accepted again, and mandatory RGPD acceptance is required before the user can operate the portal.

## Acceptance Criteria

- Given an authenticated user, when they open the RGPD section of the personal area, then the full RGPD terms text and their current acceptance status are visible.
- Given a user who has not accepted the mandatory RGPD terms, when they attempt to use portal features, then the system blocks operation until acceptance is recorded.
- Given a user in the personal area, when they accept the RGPD terms, then acceptance is persisted with a timestamp and access is granted.
- Given a user who withdraws a mandatory consent, when the withdrawal is saved, then the portal blocks operation and prompts re-acceptance, while the withdrawal is logged.
- Given the personal area, when the user requests data export or erasure, then the actions defined in REQ-SEC-003 and REQ-SEC-004 remain available alongside consent management.

---
id: REQ-AUTH-005
title: First login requires acceptance of the RGPD terms before access is granted
type: Functional
module: Auth
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-SEC-001
  - REQ-SEC-002
  - REQ-SEC-003
  - REQ-SEC-004
  - REQ-SEC-005
  - REQ-SEC-006
  - REQ-AUTH-006
designRefs:
  - docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
  - docs/Requirements/diagrams/sequences/first-login-rgpd-acceptance.mmd
implementationRefs:
  - src/Habitus.Api/Controllers/AuthController.cs
  - src/Habitus.Api/Controllers/UserRegistrationController.cs
  - src/Habitus.Api/Controllers/MeController.cs
  - src/Habitus.Api/Middleware/RequireMandatoryConsentFilter.cs
  - src/Habitus.Application/Services/ConsentService.cs
  - src/habitus-web/src/App.tsx
  - src/habitus-web/src/pages/ProfilePage.tsx
testRefs:
  - tests/Habitus.Tests/AuthServiceTests.cs
  - tests/Habitus.Tests/ConsentServiceTests.cs
  - tests/Habitus.Api.IntegrationTests/ConsentGateIntegrationTests.cs
---

# REQ-AUTH-005

On the user's first authenticated portal session, the system must present the RGPD notice describing which data is encrypted and which data is stored or shown without encryption, and the user must accept the terms before continuing to the application.

## Acceptance Criteria

- Given a user who has never accepted the RGPD notice, when they authenticate for the first time, then the system displays the RGPD terms screen before granting access.
- Given an RGPD notice that lists encrypted and non-encrypted data categories, when the user accepts it, then the acceptance is persisted and the user can continue.
- Given a user who has not accepted the RGPD notice, when they try to continue after login, then the application blocks access until acceptance is recorded.

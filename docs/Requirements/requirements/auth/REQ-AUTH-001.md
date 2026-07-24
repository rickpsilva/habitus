---
id: REQ-AUTH-001
title: Role-based access restricted to the user's condominium scope
type: Non-Functional
module: Auth
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-CONDO-001
  - REQ-USERS-001
  - REQ-SEC-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/Habitus.Api/Middleware/CondominiumAccessGuardMiddleware.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Program.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/UsersController.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/UnitsController.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/ReservationsController.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/MaintenanceController.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/FinancialController.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/NotificationsController.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/PaymentsController.cs
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/InvoicesController.cs
testRefs:
  - /home/rick/workspace/habitus/tests/Habitus.Api.IntegrationTests/CondominiumScopeEnforcementTests.cs
---

# REQ-AUTH-001

Admin and Resident users can only access data belonging to their own condominium. Managers may access condominiums they manage.

## Acceptance Criteria

- Given an Admin user, when they request a resource from a different condominium, then the API returns 403 or 404.
- Given a Manager user, when they request a resource from a condominium they manage, then the API returns the resource.
- Given any authenticated user, when the condominium scope check fails, then no other tenant data is included in the response.

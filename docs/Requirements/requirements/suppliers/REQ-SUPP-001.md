---
id: REQ-SUPP-001
title: Suppliers and interventions are linked to condominiums
type: Functional
module: Suppliers
priority: Medium
status: Implemented
roles:
  - Manager
  - Admin
relatedRequirements:
  - REQ-AUTH-001
  - REQ-MAINT-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/maintenance-expense-and-notification-flow.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/SuppliersController.cs
  - /home/rick/workspace/habitus/src/Habitus.Application/Services/InterventionService.cs
testRefs: []
---

# REQ-SUPP-001

Supplier records and scheduled interventions are associated with a condominium so maintenance planning remains tenant-scoped.

## Acceptance Criteria

- Given an authorized user, when a supplier is created or updated, then it is linked to a condominium.
- Given an intervention schedule, when it is stored, then the intervention references the supplier and condominium.
- Given a user outside the condominium, when they request supplier or intervention data, then the system hides or rejects it.

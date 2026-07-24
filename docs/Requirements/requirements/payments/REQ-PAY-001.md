---
id: REQ-PAY-001
title: Payments are recorded and filtered by condominium and resident
type: Functional
module: Payments
priority: High
status: Implemented
roles:
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-PAY-002
  - REQ-INV-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/payments-approval-and-financial-flow.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/PaymentsController.cs
  - /home/rick/workspace/habitus/src/Habitus.Application/Services/PaymentService.cs
testRefs: []
---

# REQ-PAY-001

Residents and Admins can create and view payment records within their condominium, while Admins may inspect pending items for the whole condominium.

## Acceptance Criteria

- Given a Resident or Admin, when a payment is created for the allowed condominium, then the record is stored and linked to that condominium.
- Given a Resident, when viewing payments, then only that resident's own payments are returned.
- Given an Admin, when viewing pending or paged payments, then only the condominium's payments are returned.

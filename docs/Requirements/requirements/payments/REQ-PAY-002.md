---
id: REQ-PAY-002
title: Condominium payment settings are configurable and encrypted
type: Non-Functional
module: Payments
priority: High
status: Implemented
roles:
  - Manager
  - Admin
relatedRequirements:
  - REQ-SEC-001
  - REQ-PAY-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/payments-approval-and-financial-flow.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/PaymentSettingsController.cs
testRefs: []
---

# REQ-PAY-002

Bank transfer, MB reference, MB Way, and card payment settings are configurable per condominium, with sensitive values stored encrypted at rest.

## Acceptance Criteria

- Given an Admin or Manager with permission, when payment settings are updated, then the configuration is stored only for that condominium.
- Given a sensitive payment value such as IBAN or merchant ID, when it is persisted, then it is encrypted before storage.
- Given missing settings, when payment settings are fetched, then the API returns safe defaults instead of failing.

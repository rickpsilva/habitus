---
id: REQ-SEC-001
title: Sensitive data is encrypted and external callbacks are verified
type: Non-Functional
module: Security
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-PAY-002
  - REQ-BILL-002
  - REQ-INV-001
  - REQ-SEC-002
  - REQ-SEC-003
  - REQ-SEC-004
designRefs:
  - docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
  - docs/Requirements/diagrams/sequences/payments-approval-and-financial-flow.mmd
  - docs/Requirements/diagrams/sequences/notifications-dispatch-flow.mmd
---

# REQ-SEC-001

Sensitive identifiers, payment credentials, and webhook callbacks are protected through encryption, rate limiting, and signature verification.

## Acceptance Criteria

- Given a sensitive field such as NIF, IBAN, SMTP password, or webhook secret, when it is stored, then it is encrypted at rest.
- Given the public API, when requests exceed the configured limit, then rate limiting protects the service from abuse.
- Given a Stripe webhook payload, when the signature is invalid, then the system rejects or ignores the callback.

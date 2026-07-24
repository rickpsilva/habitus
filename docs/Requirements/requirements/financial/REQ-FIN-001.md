---
id: REQ-FIN-001
title: Financial records support income, expense, and summary reporting
type: Functional
module: Financial
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-PAY-001
  - REQ-FIN-002
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/payments-approval-and-financial-flow.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/FinancialController.cs
  - /home/rick/workspace/habitus/src/Habitus.Application/Services/FinancialService.cs
testRefs:
  - /home/rick/workspace/habitus/tests/Habitus.Tests/FinancialServiceTests.cs
  - /home/rick/workspace/habitus/tests/Habitus.Tests/FinancialServiceIsolationTests.cs
  - /home/rick/workspace/habitus/tests/Habitus.Tests/SaftXmlServiceTests.cs
---

# REQ-FIN-001

The system allows condominium financial records to be created and summarized as income, expense, and balance views within the allowed condominium scope.

## Acceptance Criteria

- Given an authorized condominium user, when a financial record is created, then it is stored under that condominium.
- Given a condominium and time range, when the summary report is requested, then the totals reflect only that condominium's records.
- Given a user outside the condominium, when they request financial data, then no cross-tenant data is returned.

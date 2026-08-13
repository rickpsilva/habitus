---
id: REQ-FIN-003
title: Admin views an annual Revenue and Expenses report from the Financial page, with PDF export
type: Functional
module: Financial
priority: High
status: Implemented
roles:
  - Admin
relatedRequirements:
  - REQ-FIN-001
  - REQ-FIN-002
  - REQ-CONDO-002
  - REQ-CONDO-003
designRefs:
  - docs/Requirements/diagrams/sequences/financial-annual-report.mmd
implementationRefs:
  - src/Habitus.Api/Controllers/FinancialController.cs
  - src/Habitus.Application/Services/FinancialService.cs
  - src/Habitus.Application/DTOs/Financial/AnnualFinancialReportDto.cs
  - src/habitus-web/src/pages/FinancialPage.tsx
  - src/habitus-web/src/components/AnnualReportModal.tsx
  - src/habitus-web/src/api/services.ts
  - src/habitus-web/src/types/index.ts
testRefs:
  - tests/Habitus.Tests/FinancialServiceTests.cs
  - tests/Habitus.Api.IntegrationTests/AnnualFinancialReportIntegrationTests.cs
---

# REQ-FIN-003

An Admin can open, from the Financial page, an annual Revenue + Expenses report for the currently selected fiscal year of their condominium. The report is displayed in a modal popup and can be exported to PDF.

## Acceptance Criteria

- Given an Admin on the Financial page with a fiscal year selected, when they choose the "Annual report" option, then a modal popup opens showing the Revenue + Expenses report for that year and condominium.
- Given the report modal, when it renders, then it shows total income, total expenses, and the resulting balance for the selected year, with a monthly breakdown (income, expenses, balance per month) and an expense breakdown by category.
- Given the report modal, when the Admin clicks "Export PDF", then a PDF file containing the same report data (year, totals, breakdowns) is downloaded.
- Given a year with no financial records, when the report is opened, then the modal shows zeroed totals and an explicit empty-state message instead of an error.
- Given a non-Admin user (Manager or Resident), when they attempt to access the report data endpoint directly, then the request is rejected with 403.
- Given an Admin of condominium A, when the report is generated, then only records belonging to condominium A are included; no cross-tenant data leaks into totals or breakdowns.
- Given the PDF export, when the generated file is opened, then its content matches the data displayed in the modal for the same year.

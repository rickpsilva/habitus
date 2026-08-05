---
id: REQ-MAINT-002
title: Maintenance completion requires an expense category selection
type: Functional
module: Maintenance
priority: High
status: Draft
roles:
  - Admin
relatedRequirements:
  - REQ-MAINT-001
  - REQ-CONDO-002
  - REQ-CONDO-003
  - REQ-FIN-002
designRefs:
  - docs/Requirements/diagrams/data/expense-categories.mmd
  - docs/Requirements/diagrams/sequences/maintenance-expense-category-selection.mmd
implementationRefs:
  - src/Habitus.Domain/Entities/MaintenanceRequest.cs
  - src/Habitus.Domain/Entities/FinancialRecord.cs
  - src/Habitus.Application/DTOs/UpdateMaintenanceRequest.cs
  - src/Habitus.Application/Services/MaintenanceService.cs
  - src/Habitus.Application/Services/FinancialService.cs
  - src/Habitus.Api/Controllers/MaintenanceController.cs
  - src/habitus-web/src/pages/MaintenancePage.tsx
  - src/habitus-web/src/components/maintenance/MaintenanceCompletionForm.tsx
testRefs:
  - tests/Habitus.Tests/MaintenanceServiceTests.cs
  - tests/Habitus.Tests/MaintenanceServiceIsolationTests.cs
  - tests/Habitus.Api.IntegrationTests/MaintenanceExpenseCategoryIntegrationTests.cs
---

# REQ-MAINT-002

When an Admin transitions a maintenance request to the Completed status and indicates that the work generated an expense, the system requires selection of an expense category from the condominium's configured categories.

## Acceptance Criteria

- Given an Admin marking a maintenance request as Completed with HasExpense set to true, when they do not select an expense category, then the status transition is rejected with a validation error.
- Given an Admin completing a maintenance request, when they select an expense category and enter an expense amount, then both the category identifier and amount are persisted on the maintenance request.
- Given the completion form, when the category selector is shown, then it lists only active categories for the current condominium and displays each category's hashtags.
- Given a maintenance request completed with a category, when the system generates or updates the associated financial expense record, then the same expense category is used on the financial record.
- Given a maintenance request completed without expense (HasExpense = false), when the Admin finalizes it, then no expense category is required and no financial record is created.
- Given a non-Admin user, when they attempt to complete a maintenance request, then the request is rejected regardless of category selection.

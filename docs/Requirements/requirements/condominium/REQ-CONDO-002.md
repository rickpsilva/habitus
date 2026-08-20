---
id: REQ-CONDO-002
title: Admin configures expense categories in condominium settings
type: Functional
module: Condominium
priority: High
status: Draft
roles:
  - Admin
relatedRequirements:
  - REQ-CONDO-001
  - REQ-FIN-001
  - REQ-MAINT-001
  - REQ-CONDO-003
  - REQ-FIN-002
  - REQ-MAINT-002
designRefs:
  - docs/Requirements/diagrams/data/expense-categories.mmd
implementationRefs:
  - src/Habitus.Domain/Entities/ExpenseCategory.cs
  - src/Habitus.Infrastructure/Data/HabitusDbContext.cs
  - src/Habitus.Infrastructure/Repositories/ExpenseCategoryRepository.cs
  - src/Habitus.Application/Services/ExpenseCategoryService.cs
  - src/Habitus.Api/Controllers/ExpenseCategoriesController.cs
  - src/habitus-web/src/pages/CondominiumSettingsPage.tsx
  - src/habitus-web/src/pages/ExpenseCategoriesPage.tsx
testRefs:
  - tests/Habitus.Tests/ExpenseCategoryServiceTests.cs
  - tests/Habitus.Api.IntegrationTests/ExpenseCategoryCrudIntegrationTests.cs
---

# REQ-CONDO-002

An Admin of a condominium can create, update, deactivate, and list expense categories scoped to that condominium through the condominium settings page.

## Acceptance Criteria

- Given an Admin of condominium A, when they create an expense category with a unique name within A, then the category is persisted and visible only inside condominium A.
- Given an Admin, when they update the name or active state of an existing category, then the change is reflected for future financial and maintenance records.
- Given an Admin, when they deactivate a category, then it no longer appears in new selection lists while historical records continue to reference it.
- Given a non-Admin user or an Admin of condominium B, when they attempt to create, update, or delete categories in condominium A, then the system rejects the request with a 403 or 404 response.
- Given a category already referenced by financial or maintenance records, when hard delete is attempted, then the system prevents data loss by allowing only deactivation (soft delete).
- Given the condominium settings page, when an Admin navigates to the categories tab, then they see the list of categories for the active condominium and controls to add or edit them.

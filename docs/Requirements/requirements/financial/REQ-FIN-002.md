---
id: REQ-FIN-002
title: Expense category field is autocomplete and shows associated hashtags
type: Functional
module: Financial
priority: High
status: Draft
roles:
  - Admin
relatedRequirements:
  - REQ-FIN-001
  - REQ-CONDO-002
  - REQ-CONDO-003
designRefs:
  - docs/Requirements/diagrams/data/expense-categories.mmd
  - docs/Requirements/diagrams/sequences/financial-expense-category-selection.mmd
implementationRefs:
  - src/Habitus.Domain/Entities/FinancialRecord.cs
  - src/Habitus.Application/DTOs/CreateFinancialRecordRequest.cs
  - src/Habitus.Application/Services/FinancialService.cs
  - src/Habitus.Api/Controllers/FinancialController.cs
  - src/habitus-web/src/pages/FinancialPage.tsx
  - src/habitus-web/src/components/financial/CategoryAutocomplete.tsx
testRefs:
  - tests/Habitus.Tests/FinancialServiceTests.cs
  - tests/Habitus.Tests/FinancialServiceIsolationTests.cs
  - tests/Habitus.Api.IntegrationTests/FinancialCategoryAutocompleteIntegrationTests.cs
---

# REQ-FIN-002

When an Admin creates or edits an expense financial record, the category field is an autocomplete populated with the active expense categories configured for the current condominium, and each option displays the category's associated hashtags.

## Acceptance Criteria

- Given an Admin creating an expense in condominium A, when they focus the category field, then the autocomplete lists only active expense categories configured for condominium A.
- Given the autocomplete dropdown, when categories have hashtags, then each option shows the category name followed by its hashtags.
- Given a user typing in the category field, when the typed text matches a category name or any of its hashtags, then the list filters to show matching categories.
- Given no category selected, when the user submits an expense record, then the system rejects the submission with a validation error indicating the category is required.
- Given a category belonging to condominium B, when the user attempts to select it, then it is not available in the autocomplete and cannot be submitted.
- Given an expense record saved with a category, when the record is later viewed or edited, then the selected category and its hashtags are displayed correctly.

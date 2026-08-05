---
id: REQ-CONDO-003
title: Admin catalogs expense categories with hashtags
type: Functional
module: Condominium
priority: Medium
status: Draft
roles:
  - Admin
relatedRequirements:
  - REQ-CONDO-002
  - REQ-FIN-002
  - REQ-MAINT-002
designRefs:
  - docs/Requirements/diagrams/data/expense-categories.mmd
implementationRefs:
  - src/Habitus.Domain/Entities/ExpenseCategory.cs
  - src/Habitus.Application/DTOs/ExpenseCategoryDto.cs
  - src/Habitus.Application/Validators/ExpenseCategoryValidator.cs
  - src/habitus-web/src/pages/ExpenseCategoriesPage.tsx
  - src/habitus-web/src/components/common/HashtagInput.tsx
testRefs:
  - tests/Habitus.Tests/ExpenseCategoryServiceTests.cs
  - tests/Habitus.Tests/ExpenseCategoryValidatorTests.cs
---

# REQ-CONDO-003

Each condominium expense category can be associated with one or more hashtags so that Admins can quickly identify and group categories when creating expenses or completing maintenance work.

## Acceptance Criteria

- Given an Admin creating or editing an expense category, when they provide hashtags, then the system stores them as normalized lowercase labels without spaces or special characters (e.g., `#manutencao`, `#condominio`).
- Given an input containing duplicate hashtags, when the category is saved, then duplicates are removed automatically.
- Given an input containing hashtags with invalid characters or excessive length, when the category is saved, then the system rejects the input with a clear validation message.
- Given a category with hashtags, when the category is displayed in selection components, then the hashtags are shown alongside the category name.
- Given a category rendered in the settings list, when hashtags exist, then they appear as distinct badges or labels.

# Server-side pagination

## Goal

List endpoints previously loaded **all** rows for a condominium via `IRepository.FindAsync`
and then paged/filtered in memory (`PaginationHelper.Paginate`). This scales poorly as data
grows. The reusable primitive below pushes filtering, ordering and paging to the database so
only the requested page is materialised.

## Reusable primitive

`IRepository<T>.GetPagedAsync` (implemented in `Repository<T>`):

```csharp
Task<PaginatedResponse<T>> GetPagedAsync(
    int page,
    int pageSize,
    Expression<Func<T, bool>> filter,   // MUST include tenant scoping (CondominiumId)
    Expression<Func<T, object>> orderBy,
    bool descending = false);
```

- Applies `WHERE` (`filter`), `ORDER BY` (`orderBy`), a separate `COUNT`, and `Skip`/`Take`
  at the provider level (EF Core / Npgsql).
- Clamps `page` (>= 1) and `pageSize` (>= 1) defensively.
- Returns `PaginatedResponse<T>` (`Items`, `Page`, `PageSize`, `TotalItems`, `TotalPages`).

## Service pattern (reference: `FinancialService`)

1. Normalise `page`/`pageSize` (e.g. `pageSize` clamped to `1..100`).
2. Build a **tenant-scoped** filter that also encodes the optional search:
   - Plain string columns → `x.Column.ToLower().Contains(searchLower)` (translates to
     case-insensitive `LOWER(col) LIKE ...`).
   - Enum columns → pre-resolve matching enum values in C# and use `values.Contains(x.Enum)`
     (translates to `IN (...)`); `Enum.ToString()` is **not** reliably translatable.
3. Call `repository.GetPagedAsync(...)`, then map the page items to DTOs and copy the metadata.

## Constraint: encrypted columns

Entities with **encrypted** searchable fields (e.g. `Supplier` e-mail/phone, `User`/`Resident`
personal data) cannot filter those columns in SQL. For those, page at the database level only
for the no-search path and keep search in memory, or search on non-encrypted columns only.

## Roll-out status

- **Done (DB-level):**
  - `FinancialService.GetPagedAsync` / `GetPagedByYearAsync`.
  - `MaintenanceService.GetPagedAsync` — access rules (`Admin` sees all in the condominium;
    `Resident` sees own requests / own unit) encoded as a SQL-translatable predicate; other
    roles short-circuit to an empty page without querying. Search on `Title`/`Description`/`Location`.
  - `ReservationService.GetPagedAsync` — tenant filter + search on `AdminComments`, ordered by `StartTime`.
  - `NotificationService.GetPagedAsync` — `CanUserAccessNotification` expressed as a predicate
    (manager sees manager-targeted/direct; others see role-generic/direct within the condominium),
    ordered by `SentAt`.
  - `PaymentService.GetPagedAsync` — tenant filter, ordered by `CreatedDate` (no search).
  - Repository-based controllers `Units` and `SharedSpaces` (plain columns; full DB pagination
    including search), and `Suppliers` (DB pagination on the **no-search** path; search stays in
    memory because e-mail is encrypted).
- **Intentionally kept in memory (documented exceptions):**
  - `AssemblyService.GetPagedAsync` — auto-transitions scheduled assemblies to *in progress*
    (`UpdateScheduledAssembliesStatusAsync`) over the **full** matching set as a side effect of the
    read; DB-level paging would only update the current page. Left in memory until that side effect
    is moved to a targeted update.
  - `CondominiumService.GetPagedCondominiumsAsync` — search covers the **decrypted address** and each
    row carries computed `TotalUnits`/`TotalUsers` aggregates, so it cannot be filtered/counted purely
    in SQL. Cardinality is low (platform-level condominium list).
  - `UserService` (`GetPagedUsersAsync` / `GetUsersByCondominiumPagedAsync`) — e-mail/name are
    encrypted, so search must decrypt in memory; the role/tenant filter is applied server-side so the
    counts are correct.

## Tests

- `RepositoryPaginationTests` (EF Core InMemory): paging math, condominium isolation,
  ordering, filter predicate, argument clamping.
- `FinancialServicePaginationTests`, `MaintenanceServicePaginationTests`,
  `ReservationServicePaginationTests`, `NotificationServicePaginationTests`,
  `PaymentServicePaginationTests` (mocked repository): DTO mapping / metadata forwarding, tenant
  scoping and role/access branches via the compiled filter predicate, and `page`/`pageSize`
  normalisation.
- `UserServicePaginationTests`, `ReservationServiceIsolationTests`, `FinancialServiceIsolationTests`
  cover role/tenant isolation on the paged paths.
- The `Units`/`SharedSpaces`/`Suppliers` controller endpoints reuse the repository primitive with an
  unchanged tenant predicate, so their paging/isolation mechanics are covered by
  `RepositoryPaginationTests` plus the existing scope integration tests.

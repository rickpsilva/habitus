# DbContext Concurrency Guideline

## Context

Habitus registers `HabitusDbContext` as a pooled, scoped service (`AddDbContextPool`).
All repository implementations receive the same scoped `DbContext` instance per HTTP request.

## Rule

**Never start multiple concurrent async EF Core operations on the same `DbContext` instance.**
Doing so triggers:

```
System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed.
```

`AsNoTracking()` does **not** remove this restriction; the EF Core `ConcurrencyDetector`
still serializes access to the context.

## Applies to

- Application services using `IRepository<T>` (all repositories share the request's `DbContext`).
- Middleware that resolves `HabitusDbContext` directly.
- Any code path calling `Task.WhenAll` with multiple repository queries.

## Prefer

- Sequential `await` calls when results depend on each other.
- Sequential `await` calls even when results are independent, unless you explicitly
  resolve separate `DbContext` scopes (not the default in Habitus).

## Example

```csharp
// BAD: same scoped DbContext, concurrent queries
var managerTask = _userRepository.GetByIdNoTrackingAsync(managerId);
var targetTask  = _userRepository.GetByIdNoTrackingAsync(targetUserId);
await Task.WhenAll(managerTask, targetTask);

// GOOD: sequential await
var manager = await _userRepository.GetByIdNoTrackingAsync(managerId);
var target  = await _userRepository.GetByIdNoTrackingAsync(targetUserId);
```

## Where this was enforced

- `src/Habitus.Application/Services/AuthService.cs` — impersonation methods previously
  used `Task.WhenAll` across repositories and were converted to sequential awaits.

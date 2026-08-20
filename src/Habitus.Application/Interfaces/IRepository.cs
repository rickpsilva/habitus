using System.Linq.Expressions;
using Habitus.Application.DTOs.Common;

namespace Habitus.Application.Interfaces;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(Guid id);
    Task<T?> GetByIdNoTrackingAsync(Guid id);
    Task<T?> GetByIdWithIncludesAsync(Guid id, params string[] includes);
    Task<IEnumerable<T>> GetAllAsync();
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate);
    Task<T?> FirstOrDefaultNoTrackingAsync(Expression<Func<T, bool>> predicate);
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);
    Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null);

    /// <summary>
    /// Returns per-key row counts computed by a single server-side SQL <c>GROUP BY</c>, so only
    /// the <c>(key, count)</c> pairs are transferred and no full entities are materialised.
    /// </summary>
    Task<Dictionary<Guid, int>> CountGroupedAsync(
        Expression<Func<T, Guid>> keySelector,
        Expression<Func<T, bool>>? predicate = null);
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);

    /// <summary>
    /// Returns a single page of entities matching <paramref name="filter"/>, applying the
    /// filtering, ordering and paging at the database level (server-side) so that only the
    /// requested page is materialised. The total item count is computed with a separate
    /// <c>COUNT</c> query against the same filter.
    /// </summary>
    /// <param name="page">1-based page number. Values below 1 are clamped to 1.</param>
    /// <param name="pageSize">Number of items per page. Values below 1 default to 10.</param>
    /// <param name="filter">Predicate applied in the SQL <c>WHERE</c> clause (must include tenant scoping).</param>
    /// <param name="orderBy">Key selector used to order the results before paging.</param>
    /// <param name="descending">When true, orders descending; otherwise ascending.</param>
    /// <returns>A <see cref="PaginatedResponse{T}"/> with the page items and paging metadata.</returns>
    Task<PaginatedResponse<T>> GetPagedAsync(
        int page,
        int pageSize,
        Expression<Func<T, bool>> filter,
        Expression<Func<T, object>> orderBy,
        bool descending = false);
    Task<IEnumerable<T>> FindWithIncludesAsync(Expression<Func<T, bool>> predicate, params string[] includes);

    /// <summary>
    /// Returns a single page of entities with includes, applying filtering, ordering and paging at the database level.
    /// </summary>
    Task<PaginatedResponse<T>> GetPagedWithIncludesAsync(
        int page,
        int pageSize,
        Expression<Func<T, bool>> filter,
        Expression<Func<T, object>> orderBy,
        bool descending,
        params string[] includes);
    Task AddAsync(T entity);
    void Update(T entity);
    void Remove(T entity);
    Task<int> SaveChangesAsync();
}

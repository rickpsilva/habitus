using System.Linq.Expressions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Interfaces;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Habitus.Infrastructure.Repositories;

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly HabitusDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(HabitusDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public async Task<T?> GetByIdAsync(Guid id) => await _dbSet.FindAsync(id);

    public async Task<T?> GetByIdWithIncludesAsync(Guid id, params string[] includes)
    {
        IQueryable<T> query = _dbSet;
        
        foreach (var include in includes)
        {
            query = query.Include(include);
        }
        
        // Try to find by Id property
        var parameter = Expression.Parameter(typeof(T), "x");
        var property = Expression.Property(parameter, "Id");
        var idValue = Expression.Constant(id);
        var equals = Expression.Equal(property, idValue);
        var lambda = Expression.Lambda<Func<T, bool>>(equals, parameter);
        
        return await query.FirstOrDefaultAsync(lambda);
    }

    public async Task<IEnumerable<T>> GetAllAsync() => await _dbSet.ToListAsync();

    public async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate)
        => await _dbSet.FirstOrDefaultAsync(predicate);

    public async Task<T?> FirstOrDefaultNoTrackingAsync(Expression<Func<T, bool>> predicate)
        => await _dbSet.AsNoTracking().FirstOrDefaultAsync(predicate);

    public async Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate)
        => await _dbSet.AnyAsync(predicate);

    public async Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null)
        => predicate == null ? await _dbSet.CountAsync() : await _dbSet.CountAsync(predicate);

    public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
        => await _dbSet.Where(predicate).ToListAsync();

    public async Task<PaginatedResponse<T>> GetPagedAsync(
        int page,
        int pageSize,
        Expression<Func<T, bool>> filter,
        Expression<Func<T, object>> orderBy,
        bool descending = false)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;

        // Display-only projection: no tracking avoids the change-tracker overhead.
        var query = _dbSet.AsNoTracking().Where(filter);
        query = descending ? query.OrderByDescending(orderBy) : query.OrderBy(orderBy);

        var totalItems = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PaginatedResponse<T>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
        };
    }

    public async Task<IEnumerable<T>> FindWithIncludesAsync(
        Expression<Func<T, bool>> predicate,
        params string[] includes)
    {
        IQueryable<T> query = _dbSet;
        
        foreach (var include in includes)
        {
            query = query.Include(include);
        }
        
        return await query.Where(predicate).ToListAsync();
    }

    public async Task AddAsync(T entity) => await _dbSet.AddAsync(entity);

    public void Update(T entity) => _dbSet.Update(entity);

    public void Remove(T entity) => _dbSet.Remove(entity);

    public async Task<int> SaveChangesAsync() => await _context.SaveChangesAsync();
}

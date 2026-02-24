using System.Linq.Expressions;
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

    public async Task<IEnumerable<T>> GetAllAsync() => await _dbSet.ToListAsync();

    public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
        => await _dbSet.Where(predicate).ToListAsync();

    public async Task AddAsync(T entity) => await _dbSet.AddAsync(entity);

    public void Update(T entity) => _dbSet.Update(entity);

    public void Remove(T entity) => _dbSet.Remove(entity);

    public async Task<int> SaveChangesAsync() => await _context.SaveChangesAsync();
}

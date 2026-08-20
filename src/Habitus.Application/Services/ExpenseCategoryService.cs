using Habitus.Application.DTOs.ExpenseCategory;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Caching.Memory;

namespace Habitus.Application.Services;

public class ExpenseCategoryService
{
    private readonly IRepository<ExpenseCategory> _repository;
    private readonly IMemoryCache _cache;

    public ExpenseCategoryService(IRepository<ExpenseCategory> repository, IMemoryCache cache)
    {
        _repository = repository;
        _cache = cache;
    }

    private const string CacheKeyPrefix = "expense_categories_";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    private string GetCacheKey(Guid condominiumId, bool activeOnly = false)
        => $"{CacheKeyPrefix}{condominiumId}_{(activeOnly ? "active" : "all")}";

    public async Task<IEnumerable<ExpenseCategoryDto>> GetAllAsync(Guid condominiumId)
    {
        var cacheKey = GetCacheKey(condominiumId, false);
        
        if (_cache.TryGetValue(cacheKey, out IEnumerable<ExpenseCategoryDto>? cached))
        {
            return cached!;
        }

        var categories = await _repository.FindAsync(c =>
            c.CondominiumId == condominiumId);
        var result = categories.OrderBy(c => c.Name).Select(MapToDto).ToList();
        
        _cache.Set(cacheKey, result, CacheDuration);
        return result;
    }

    public async Task<IEnumerable<ExpenseCategoryDto>> GetActiveAsync(Guid condominiumId)
    {
        var cacheKey = GetCacheKey(condominiumId, true);
        
        if (_cache.TryGetValue(cacheKey, out IEnumerable<ExpenseCategoryDto>? cached))
        {
            return cached!;
        }

        var categories = await _repository.FindAsync(c =>
            c.CondominiumId == condominiumId && c.IsActive && !c.IsDeleted);
        var result = categories.OrderBy(c => c.Name).Select(MapToDto).ToList();
        
        _cache.Set(cacheKey, result, CacheDuration);
        return result;
    }

    public async Task<ExpenseCategoryDto?> GetByIdAsync(Guid id, Guid condominiumId)
    {
        var category = await _repository.GetByIdAsync(id);
        if (category == null || category.CondominiumId != condominiumId) return null;
        return MapToDto(category);
    }

    public async Task<ExpenseCategoryDto> CreateAsync(CreateExpenseCategoryRequest request)
    {
        var normalizedName = NormalizeName(request.Name);
        await EnsureNameUniqueAsync(request.CondominiumId, normalizedName);

        var category = new ExpenseCategory
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            NormalizedName = normalizedName,
            Hashtags = NormalizeHashtags(request.Hashtags),
            IsActive = request.IsActive,
            IsDeleted = false,
            CondominiumId = request.CondominiumId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(category);
        await _repository.SaveChangesAsync();
        
        // Invalidate cache
        InvalidateCache(request.CondominiumId);
        
        return MapToDto(category);
    }

    public async Task<ExpenseCategoryDto?> UpdateAsync(Guid id, UpdateExpenseCategoryRequest request, Guid condominiumId)
    {
        var category = await _repository.GetByIdAsync(id);
        if (category == null || category.CondominiumId != condominiumId || category.IsDeleted) return null;

        var normalizedName = NormalizeName(request.Name);
        if (!string.Equals(category.NormalizedName, normalizedName, StringComparison.OrdinalIgnoreCase))
        {
            await EnsureNameUniqueAsync(condominiumId, normalizedName);
        }

        category.Name = request.Name.Trim();
        category.NormalizedName = normalizedName;
        category.Hashtags = NormalizeHashtags(request.Hashtags);
        category.IsActive = request.IsActive;
        category.UpdatedAt = DateTime.UtcNow;

        _repository.Update(category);
        await _repository.SaveChangesAsync();
        
        // Invalidate cache
        InvalidateCache(condominiumId);
        
        return MapToDto(category);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid condominiumId)
    {
        var category = await _repository.GetByIdAsync(id);
        if (category == null || category.CondominiumId != condominiumId || category.IsDeleted) return false;

        category.IsDeleted = true;
        category.IsActive = false;
        category.UpdatedAt = DateTime.UtcNow;
        _repository.Update(category);
        await _repository.SaveChangesAsync();
        
        // Invalidate cache
        InvalidateCache(condominiumId);
        
        return true;
    }

    private void InvalidateCache(Guid condominiumId)
    {
        _cache.Remove(GetCacheKey(condominiumId, false));
        _cache.Remove(GetCacheKey(condominiumId, true));
    }

    public static List<string> NormalizeHashtags(IEnumerable<string> hashtags)
    {
        return hashtags
            .Select(h =>
            {
                var trimmed = h.Trim();
                if (trimmed.StartsWith('#')) trimmed = trimmed[1..];
                return trimmed.ToLowerInvariant();
            })
            .Where(h => !string.IsNullOrWhiteSpace(h))
            .Distinct()
            .Take(20)
            .ToList();
    }

    public static string NormalizeName(string name) => name.Trim().ToLowerInvariant();

    public static bool IsValidHashtag(string hashtag)
    {
        var value = hashtag.Trim();
        if (value.StartsWith('#')) value = value[1..];
        if (string.IsNullOrWhiteSpace(value)) return false;
        return value.Length <= 50 && value.All(c => char.IsLetterOrDigit(c) || c == '_' || c == '-');
    }

    private async Task EnsureNameUniqueAsync(Guid condominiumId, string normalizedName)
    {
        var exists = await _repository.ExistsAsync(c =>
            c.CondominiumId == condominiumId &&
            c.NormalizedName == normalizedName &&
            !c.IsDeleted);

        if (exists)
        {
            throw new InvalidOperationException("Já existe uma categoria de despesa com este nome no condomínio.");
        }
    }

    private static ExpenseCategoryDto MapToDto(ExpenseCategory c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Hashtags = c.Hashtags,
        IsActive = c.IsActive,
        CondominiumId = c.CondominiumId
    };
}

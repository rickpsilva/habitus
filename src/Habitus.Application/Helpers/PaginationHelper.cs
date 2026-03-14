using Habitus.Application.DTOs.Common;

namespace Habitus.Application.Helpers;

public static class PaginationHelper
{
    public static PaginatedResponse<T> Paginate<T>(
        IEnumerable<T> items,
        int page,
        int pageSize)
    {
        var itemsList = items.ToList();
        var totalItems = itemsList.Count;
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        
        var paginatedItems = itemsList
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new PaginatedResponse<T>
        {
            Items = paginatedItems,
            Page = page,
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = totalPages
        };
    }
}

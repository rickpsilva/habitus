using System.Linq.Expressions;
using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Financial;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class FinancialService
{
    private readonly IRepository<FinancialRecord> _repository;
    private readonly IRepository<ReserveFund> _reserveFundRepository;
    private readonly IRepository<Announcement> _announcementRepository;
    private readonly IRepository<ExpenseCategory> _expenseCategoryRepository;
    private readonly IFinancialQueryService _financialQueryService;

    public FinancialService(
        IRepository<FinancialRecord> repository,
        IRepository<ReserveFund> reserveFundRepository,
        IRepository<Announcement> announcementRepository,
        IRepository<ExpenseCategory> expenseCategoryRepository,
        IFinancialQueryService financialQueryService)
    {
        _repository = repository;
        _reserveFundRepository = reserveFundRepository;
        _announcementRepository = announcementRepository;
        _expenseCategoryRepository = expenseCategoryRepository;
        _financialQueryService = financialQueryService;
    }

    public async Task<IEnumerable<FinancialRecordDto>> GetAllAsync(Guid condominiumId)
    {
        var records = await _repository.FindWithIncludesAsync(
            r => r.CondominiumId == condominiumId,
            nameof(FinancialRecord.ExpenseCategory));
        return records.Select(MapToDto);
    }

    public async Task<PaginatedResponse<FinancialRecordDto>> GetPagedAsync(int page, int pageSize, Guid condominiumId, string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var searchLower = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        // Pre-resolve matching income/reserve enum values and translate the search
        // into predicates the provider can execute server-side.
        var matchingIncomeCategories = searchLower is null
            ? Array.Empty<IncomeCategory>()
            : Enum.GetValues<IncomeCategory>()
                .Where(c => c.ToString().ToLowerInvariant().Contains(searchLower))
                .ToArray();

        var matchingReserveCategories = searchLower is null
            ? Array.Empty<ReserveFundCategory>()
            : Enum.GetValues<ReserveFundCategory>()
                .Where(c => c.ToString().ToLowerInvariant().Contains(searchLower))
                .ToArray();

        Expression<Func<FinancialRecord, bool>> filter = (FinancialRecord r) =>
            r.CondominiumId == condominiumId &&
            (searchLower == null ||
             r.Description.ToLower().Contains(searchLower) ||
             (r.IncomeCategory.HasValue && matchingIncomeCategories.Contains(r.IncomeCategory.Value)) ||
             (r.ReserveFundCategory.HasValue && matchingReserveCategories.Contains(r.ReserveFundCategory.Value)) ||
             (r.ExpenseCategory != null && r.ExpenseCategory.Name.ToLower().Contains(searchLower)));

        var paged = await _repository.GetPagedWithIncludesAsync(
            page,
            pageSize,
            filter,
            r => r.Date,
            descending: true,
            nameof(FinancialRecord.ExpenseCategory));

        return new PaginatedResponse<FinancialRecordDto>
        {
            Items = paged.Items.Select(MapToDto).ToList(),
            Page = paged.Page,
            PageSize = paged.PageSize,
            TotalItems = paged.TotalItems,
            TotalPages = paged.TotalPages
        };
    }

    public async Task<FinancialRecordDto?> GetByIdAsync(Guid id, Guid condominiumId)
    {
        var item = await _repository.GetByIdWithIncludesAsync(id, nameof(FinancialRecord.ExpenseCategory));
        if (item == null || item.CondominiumId != condominiumId) return null;
        return MapToDto(item);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid condominiumId)
    {
        var item = await _repository.GetByIdAsync(id);
        if (item == null || item.CondominiumId != condominiumId) return false;
        _repository.Remove(item);
        await _repository.SaveChangesAsync();
        return true;
    }

    public async Task<FinancialRecordDto> CreateAsync(CreateFinancialRecordRequest request)
    {
        var type = Enum.Parse<FinancialType>(request.Type, ignoreCase: true);

        FinancialRecord entity;
        if (type == FinancialType.Income)
        {
            if (string.IsNullOrWhiteSpace(request.IncomeCategory))
            {
                throw new InvalidOperationException("Categoria de receita é obrigatória para registos de receita.");
            }

            entity = new FinancialRecord
            {
                Id = Guid.NewGuid(),
                Type = type,
                Amount = request.Amount,
                Description = request.Description,
                Date = request.Date,
                FiscalYear = request.Date.Year,
                IncomeCategory = Enum.Parse<IncomeCategory>(request.IncomeCategory, ignoreCase: true),
                CondominiumId = request.CondominiumId,
                ReceiptUrl = request.ReceiptUrl
            };
        }
        else
        {
            if (!request.ExpenseCategoryId.HasValue)
            {
                throw new InvalidOperationException("Categoria de despesa é obrigatória para registos de despesa.");
            }

            var category = await _expenseCategoryRepository.FirstOrDefaultAsync(c =>
                c.Id == request.ExpenseCategoryId.Value &&
                c.CondominiumId == request.CondominiumId &&
                c.IsActive &&
                !c.IsDeleted);

            if (category == null)
            {
                throw new InvalidOperationException("Categoria de despesa não encontrada ou inativa.");
            }

            entity = new FinancialRecord
            {
                Id = Guid.NewGuid(),
                Type = type,
                Amount = request.Amount,
                Description = request.Description,
                Date = request.Date,
                FiscalYear = request.Date.Year,
                ExpenseCategoryId = category.Id,
                CondominiumId = request.CondominiumId,
                ReceiptUrl = request.ReceiptUrl
            };
        }

        await _repository.AddAsync(entity);
        await _repository.SaveChangesAsync();
        return MapToDto(entity);
    }

    public async Task<FinancialSummaryDto> GetSummaryAsync(Guid condominiumId)
    {
        var records = await _repository.FindWithIncludesAsync(
            r => r.CondominiumId == condominiumId,
            nameof(FinancialRecord.ExpenseCategory));
        var dtos = records.Select(MapToDto).ToList();
        var totalIncome = dtos.Where(r => r.Type == "Income").Sum(r => r.Amount);
        var totalExpense = dtos.Where(r => r.Type == "Expense").Sum(r => r.Amount);
        return new FinancialSummaryDto
        {
            TotalIncome = totalIncome,
            TotalExpense = totalExpense,
            Balance = totalIncome - totalExpense,
            Records = dtos
        };
    }

    public async Task<FinancialDashboardDto> GetDashboardAsync(Guid condominiumId, int? fiscalYear = null)
    {
        var targetYear = fiscalYear ?? DateTime.UtcNow.Year;
        var previousYear = targetYear - 1;

        // Get records for the target year (exclude reserve fund movements)
        var yearRecords = await _repository.FindAsync(r =>
            r.CondominiumId == condominiumId &&
            r.FiscalYear == targetYear &&
            r.ReserveFundCategory == null);

        var yearDtos = yearRecords.Select(MapToDto).ToList();
        var yearIncome = yearDtos.Where(r => r.Type == "Income").Sum(r => r.Amount);
        var yearExpenses = yearDtos.Where(r => r.Type == "Expense").Sum(r => r.Amount);

        // Get reserve fund for current year
        var reserveFund = await _reserveFundRepository.FindAsync(f =>
            f.CondominiumId == condominiumId && f.FiscalYear == targetYear);
        var fund = reserveFund.FirstOrDefault();

        // Get all fiscal years available
        var allRecords = await _repository.FindAsync(r => r.CondominiumId == condominiumId);
        var availableYears = allRecords.Select(r => r.FiscalYear).Distinct().OrderByDescending(y => y).ToList();

        // Get published announcements for noise/perturbations and compute year-over-year counts.
        var noiseAnnouncements = await _announcementRepository.FindAsync(a =>
            a.CondominiumId == condominiumId &&
            a.Category == AnnouncementCategory.Noise &&
            a.Status == AnnouncementStatus.Published);

        var noiseCurrentYear = noiseAnnouncements.Count(a => (a.PublishedAt ?? a.CreatedAt).Year == targetYear);
        var noisePreviousYear = noiseAnnouncements.Count(a => (a.PublishedAt ?? a.CreatedAt).Year == previousYear);

        return new FinancialDashboardDto
        {
            CurrentYear = targetYear,
            CurrentYearIncome = yearIncome,
            CurrentYearExpenses = yearExpenses,
            CurrentYearBalance = yearIncome - yearExpenses,
            ReserveFundBalance = fund?.ClosingBalance ?? 0,
            ReserveFundDeposits = fund?.Deposits ?? 0,
            ReserveFundWithdrawals = fund?.Withdrawals ?? 0,
            CurrentYearRecords = yearDtos,
            AvailableFiscalYears = availableYears,
            NoiseAnnouncementsCurrentYear = noiseCurrentYear,
            NoiseAnnouncementsPreviousYear = noisePreviousYear
        };
    }

    public async Task<List<int>> GetAvailableFiscalYearsAsync(Guid condominiumId)
    {
        var records = await _repository.FindAsync(r => r.CondominiumId == condominiumId);
        return records.Select(r => r.FiscalYear).Distinct().OrderByDescending(y => y).ToList();
    }

    public async Task<AnnualFinancialReportDto> GetAnnualReportAsync(Guid condominiumId, int year)
    {
        // Use raw SQL for efficient server-side aggregation via IFinancialQueryService
        var monthlyBreakdown = await _financialQueryService.GetMonthlyBreakdownAsync(condominiumId, year);
        var incomeByCategory = await _financialQueryService.GetIncomeByCategoryAsync(condominiumId, year);
        var expensesByTag = await _financialQueryService.GetExpensesByTagAsync(condominiumId, year);
        var expensesByTagMonthly = await _financialQueryService.GetExpensesByTagMonthlyAsync(condominiumId, year);

        // Debug: check if mock is returning null
        Console.WriteLine($"DEBUG: monthlyBreakdown is null: {monthlyBreakdown == null}");
        Console.WriteLine($"DEBUG: monthlyBreakdown count: {monthlyBreakdown?.Count ?? -1}");
        Console.WriteLine($"DEBUG: incomeByCategory is null: {incomeByCategory == null}");
        Console.WriteLine($"DEBUG: expensesByTag is null: {expensesByTag == null}");
        Console.WriteLine($"DEBUG: expensesByTagMonthly is null: {expensesByTagMonthly == null}");

        monthlyBreakdown ??= new List<MonthlyFinancialBreakdownDto>();
        incomeByCategory ??= new List<CategoryTotalDto>();
        expensesByTag ??= new List<CategoryTotalDto>();
        expensesByTagMonthly ??= new List<TagMonthlyBreakdownDto>();

        var totalIncome = monthlyBreakdown.Sum(m => m.Income);
        var totalExpenses = monthlyBreakdown.Sum(m => m.Expenses);

        return new AnnualFinancialReportDto
        {
            Year = year,
            TotalIncome = totalIncome,
            TotalExpenses = totalExpenses,
            Balance = totalIncome - totalExpenses,
            MonthlyBreakdown = monthlyBreakdown,
            IncomeByCategory = incomeByCategory,
            ExpensesByTag = expensesByTag,
            ExpensesByTagMonthly = expensesByTagMonthly
        };
    }

    private static List<TagMonthlyBreakdownDto> BuildTagMonthlyBreakdown(IEnumerable<FinancialRecordDto> expenses)
    {
        var result = new List<TagMonthlyBreakdownDto>();

        // Group by tag (first hashtag, fallback to category name)
        var groupedByTag = expenses
            .GroupBy(r =>
                r.ExpenseCategoryHashtags.FirstOrDefault()
                ?? (string.IsNullOrWhiteSpace(r.Category) ? "Sem categoria" : r.Category))
            .OrderByDescending(g => g.Sum(r => r.Amount));

        foreach (var tagGroup in groupedByTag)
        {
            var tagName = tagGroup.Key;
            var tagTotal = tagGroup.Sum(r => r.Amount);

            // Calculate monthly totals for the tag
            var tagMonthlyValues = Enumerable.Range(1, 12)
                .Select(month => tagGroup.Where(r => r.Date.Month == month).Sum(r => r.Amount))
                .ToList();

            // Add tag header row
            result.Add(new TagMonthlyBreakdownDto
            {
                Tag = tagName,
                Category = null,
                IsTagGroup = true,
                MonthlyValues = tagMonthlyValues,
                Total = tagTotal
            });

            // Group records under this tag by their specific category name
            var groupedByCategory = tagGroup
                .GroupBy(r => string.IsNullOrWhiteSpace(r.Category) ? "Sem categoria" : r.Category)
                .OrderByDescending(g => g.Sum(r => r.Amount));

            foreach (var categoryGroup in groupedByCategory)
            {
                var categoryMonthlyValues = Enumerable.Range(1, 12)
                    .Select(month => categoryGroup.Where(r => r.Date.Month == month).Sum(r => r.Amount))
                    .ToList();

                result.Add(new TagMonthlyBreakdownDto
                {
                    Tag = tagName,
                    Category = categoryGroup.Key,
                    IsTagGroup = false,
                    MonthlyValues = categoryMonthlyValues,
                    Total = categoryGroup.Sum(r => r.Amount)
                });
            }
        }

        return result;
    }

    private static List<CategoryTotalDto> GroupByCategory(IEnumerable<FinancialRecordDto> records) =>
        records
            .GroupBy(r => string.IsNullOrWhiteSpace(r.Category) ? "Sem categoria" : r.Category)
            .Select(g => new CategoryTotalDto { Category = g.Key, Total = g.Sum(r => r.Amount) })
            .OrderByDescending(c => c.Total)
            .ToList();

    // Expenses group by the category tag (first hashtag); falls back to the category
    // name when the category has no hashtags, then to "Sem categoria".
    private static List<CategoryTotalDto> GroupByTag(IEnumerable<FinancialRecordDto> records) =>
        records
            .GroupBy(r =>
                r.ExpenseCategoryHashtags.FirstOrDefault()
                ?? (string.IsNullOrWhiteSpace(r.Category) ? "Sem categoria" : r.Category))
            .Select(g => new CategoryTotalDto { Category = g.Key, Total = g.Sum(r => r.Amount) })
            .OrderByDescending(c => c.Total)
            .ToList();

    public async Task<PaginatedResponse<FinancialRecordDto>> GetPagedByYearAsync(
        Guid condominiumId,
        int fiscalYear,
        int page,
        int pageSize,
        string? search = null,
        string? type = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var searchLower = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        FinancialType? typeFilter = null;
        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<FinancialType>(type, ignoreCase: true, out var parsedType))
        {
            typeFilter = parsedType;
        }

        var matchingIncomeCategories = searchLower is null
            ? Array.Empty<IncomeCategory>()
            : Enum.GetValues<IncomeCategory>()
                .Where(c => c.ToString().ToLowerInvariant().Contains(searchLower))
                .ToArray();

        var matchingReserveCategories = searchLower is null
            ? Array.Empty<ReserveFundCategory>()
            : Enum.GetValues<ReserveFundCategory>()
                .Where(c => c.ToString().ToLowerInvariant().Contains(searchLower))
                .ToArray();

        Expression<Func<FinancialRecord, bool>> filter = (FinancialRecord r) =>
            r.CondominiumId == condominiumId &&
            r.FiscalYear == fiscalYear &&
            (typeFilter == null || r.Type == typeFilter.Value) &&
            (searchLower == null ||
             r.Description.ToLower().Contains(searchLower) ||
             (r.IncomeCategory.HasValue && matchingIncomeCategories.Contains(r.IncomeCategory.Value)) ||
             (r.ReserveFundCategory.HasValue && matchingReserveCategories.Contains(r.ReserveFundCategory.Value)) ||
             (r.ExpenseCategory != null && r.ExpenseCategory.Name.ToLower().Contains(searchLower)));

        var paged = await _repository.GetPagedWithIncludesAsync(
            page,
            pageSize,
            filter,
            r => r.Date,
            descending: true,
            nameof(FinancialRecord.ExpenseCategory));

        return new PaginatedResponse<FinancialRecordDto>
        {
            Items = paged.Items.Select(MapToDto).ToList(),
            Page = paged.Page,
            PageSize = paged.PageSize,
            TotalItems = paged.TotalItems,
            TotalPages = paged.TotalPages
        };
    }

    private static FinancialRecordDto MapToDto(FinancialRecord r) => new()
    {
        Id = r.Id,
        Type = r.Type.ToString(),
        Amount = r.Amount,
        Description = r.Description,
        Date = r.Date,
        FiscalYear = r.FiscalYear,
        IncomeCategory = r.IncomeCategory?.ToString(),
        ExpenseCategoryId = r.ExpenseCategoryId,
        ExpenseCategoryName = r.ExpenseCategory?.Name,
        ExpenseCategoryHashtags = r.ExpenseCategory?.Hashtags ?? new List<string>(),
        ReserveFundCategory = r.ReserveFundCategory?.ToString(),
        CondominiumId = r.CondominiumId,
        ReceiptUrl = r.ReceiptUrl
    };
}

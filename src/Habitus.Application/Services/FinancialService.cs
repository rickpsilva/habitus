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

    public FinancialService(
        IRepository<FinancialRecord> repository,
        IRepository<ReserveFund> reserveFundRepository,
        IRepository<Announcement> announcementRepository)
    {
        _repository = repository;
        _reserveFundRepository = reserveFundRepository;
        _announcementRepository = announcementRepository;
    }

    public async Task<IEnumerable<FinancialRecordDto>> GetAllAsync(Guid condominiumId)
    {
        var records = await _repository.FindAsync(r => r.CondominiumId == condominiumId);
        return records.Select(MapToDto);
    }

    public async Task<PaginatedResponse<FinancialRecordDto>> GetPagedAsync(int page, int pageSize, Guid condominiumId, string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var searchLower = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        // Enum categories cannot be filtered with a text LIKE at the database level, so we
        // pre-resolve the matching enum values (a small, bounded set) and translate the search
        // into an IN clause the provider can execute server-side.
        var matchingCategories = searchLower is null
            ? Array.Empty<FinancialCategory>()
            : Enum.GetValues<FinancialCategory>()
                .Where(c => c.ToString().ToLower().Contains(searchLower))
                .ToArray();

        var paged = await _repository.GetPagedAsync(
            page,
            pageSize,
            r => r.CondominiumId == condominiumId &&
                 (searchLower == null ||
                  r.Description.ToLower().Contains(searchLower) ||
                  matchingCategories.Contains(r.Category)),
            r => r.Date,
            descending: true);

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
        var item = await _repository.GetByIdAsync(id);
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
        try
        {
            var entity = new FinancialRecord
            {
                Id = Guid.NewGuid(),
                Type = Enum.Parse<FinancialType>(request.Type, ignoreCase: true),
                Amount = request.Amount,
                Description = request.Description,
                Date = request.Date,
                FiscalYear = request.Date.Year, // Automatically set fiscal year from date
                Category = Enum.Parse<FinancialCategory>(request.Category, ignoreCase: true),
                CondominiumId = request.CondominiumId,
                ReceiptUrl = request.ReceiptUrl
            };
            await _repository.AddAsync(entity);
            await _repository.SaveChangesAsync();
            return MapToDto(entity);
        }
        catch (ArgumentException ex)
        {
            throw new InvalidOperationException($"Invalid Type value: {request.Type}. Expected 'Income' or 'Expense'.", ex);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Error creating financial record: {ex.Message}", ex);
        }
    }

    public async Task<FinancialSummaryDto> GetSummaryAsync(Guid condominiumId)
    {
        var records = await _repository.FindAsync(r => r.CondominiumId == condominiumId);
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
            r.Category != FinancialCategory.ReserveFundTransfer &&
            r.Category != FinancialCategory.ReserveFundWithdrawal);
        
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

        var matchingCategories = searchLower is null
            ? Array.Empty<FinancialCategory>()
            : Enum.GetValues<FinancialCategory>()
                .Where(c => c.ToString().ToLower().Contains(searchLower))
                .ToArray();

        var paged = await _repository.GetPagedAsync(
            page,
            pageSize,
            r => r.CondominiumId == condominiumId &&
                 r.FiscalYear == fiscalYear &&
                 (typeFilter == null || r.Type == typeFilter.Value) &&
                 (searchLower == null ||
                  r.Description.ToLower().Contains(searchLower) ||
                  matchingCategories.Contains(r.Category)),
            r => r.Date,
            descending: true);

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
        Category = r.Category.ToString(),
        CondominiumId = r.CondominiumId,
        ReceiptUrl = r.ReceiptUrl
    };
}

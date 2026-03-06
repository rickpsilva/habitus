using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Financial;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class FinancialService
{
    private readonly IRepository<FinancialRecord> _repository;
    private readonly IRepository<ReserveFund> _reserveFundRepository;

    public FinancialService(
        IRepository<FinancialRecord> repository,
        IRepository<ReserveFund> reserveFundRepository)
    {
        _repository = repository;
        _reserveFundRepository = reserveFundRepository;
    }

    public async Task<IEnumerable<FinancialRecordDto>> GetAllAsync()
    {
        var records = await _repository.GetAllAsync();
        return records.Select(MapToDto);
    }

    public async Task<PaginatedResponse<FinancialRecordDto>> GetPagedAsync(int page, int pageSize, string? search = null)
    {
        var records = await _repository.GetAllAsync();
        var dtos = records.Select(MapToDto).OrderByDescending(r => r.Date);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(r =>
                r.Description.ToLower().Contains(searchLower) ||
                (r.Category ?? "").ToLower().Contains(searchLower)
            ).OrderByDescending(r => r.Date);
        }
        
        return PaginationHelper.Paginate(dtos, page, pageSize);
    }

    public async Task<FinancialRecordDto?> GetByIdAsync(Guid id)
    {
        var item = await _repository.GetByIdAsync(id);
        return item == null ? null : MapToDto(item);
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

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return false;
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return true;
    }

    public async Task<FinancialDashboardDto> GetDashboardAsync(Guid condominiumId, int? fiscalYear = null)
    {
        var targetYear = fiscalYear ?? DateTime.UtcNow.Year;
        
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
            AvailableFiscalYears = availableYears
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
        string? search = null)
    {
        var records = await _repository.FindAsync(r => 
            r.CondominiumId == condominiumId && 
            r.FiscalYear == fiscalYear);
            
        var dtos = records.Select(MapToDto).OrderByDescending(r => r.Date);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(r =>
                r.Description.ToLower().Contains(searchLower) ||
                r.Category.ToLower().Contains(searchLower)
            ).OrderByDescending(r => r.Date);
        }
        
        return PaginationHelper.Paginate(dtos, page, pageSize);
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

using Habitus.Application.DTOs.Financial;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class ReserveFundService
{
    private readonly IRepository<ReserveFund> _reserveFundRepository;
    private readonly IRepository<FinancialRecord> _financialRepository;

    public ReserveFundService(
        IRepository<ReserveFund> reserveFundRepository,
        IRepository<FinancialRecord> financialRepository)
    {
        _reserveFundRepository = reserveFundRepository;
        _financialRepository = financialRepository;
    }

    public async Task<ReserveFundDto?> GetByYearAsync(Guid condominiumId, int fiscalYear)
    {
        var fund = await _reserveFundRepository.FindAsync(
            f => f.CondominiumId == condominiumId && f.FiscalYear == fiscalYear);
        
        return fund.FirstOrDefault() is ReserveFund existing ? MapToDto(existing) : null;
    }

    public async Task<ReserveFundDto> GetOrCreateCurrentYearAsync(Guid condominiumId)
    {
        var currentYear = DateTime.UtcNow.Year;
        var existing = await GetByYearAsync(condominiumId, currentYear);
        
        if (existing != null)
            return existing;

        // Get previous year's closing balance
        var previousYear = await GetByYearAsync(condominiumId, currentYear - 1);
        var openingBalance = previousYear?.ClosingBalance ?? 0;

        // Create new year fund
        var fund = new ReserveFund
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            FiscalYear = currentYear,
            OpeningBalance = openingBalance,
            Deposits = 0,
            Withdrawals = 0,
            ClosingBalance = openingBalance,
            CreatedAt = DateTime.UtcNow
        };

        await _reserveFundRepository.AddAsync(fund);
        await _reserveFundRepository.SaveChangesAsync();
        
        return MapToDto(fund);
    }

    public async Task<ReserveFundDto> AddDepositAsync(Guid condominiumId, int fiscalYear, decimal amount, string description)
    {
        var fund = await GetOrCreateYearAsync(condominiumId, fiscalYear);
        
        // Update fund
        var entity = await _reserveFundRepository.FindAsync(
            f => f.CondominiumId == condominiumId && f.FiscalYear == fiscalYear);
        var fundEntity = entity.First();
        
        fundEntity.Deposits += amount;
        fundEntity.ClosingBalance = fundEntity.OpeningBalance + fundEntity.Deposits - fundEntity.Withdrawals;
        fundEntity.UpdatedAt = DateTime.UtcNow;
        
        _reserveFundRepository.Update(fundEntity);
        await _reserveFundRepository.SaveChangesAsync();

        // Create financial record
        var record = new FinancialRecord
        {
            Id = Guid.NewGuid(),
            Type = FinancialType.Expense,
            Amount = amount,
            Description = description,
            Date = DateTime.UtcNow,
            FiscalYear = fiscalYear,
            Category = FinancialCategory.ReserveFundTransfer,
            CondominiumId = condominiumId
        };
        
        await _financialRepository.AddAsync(record);
        await _financialRepository.SaveChangesAsync();
        
        return MapToDto(fundEntity);
    }

    public async Task<ReserveFundDto> AddWithdrawalAsync(Guid condominiumId, int fiscalYear, decimal amount, string description)
    {
        var fund = await GetOrCreateYearAsync(condominiumId, fiscalYear);
        
        if (fund.ClosingBalance < amount)
            throw new InvalidOperationException("Saldo insuficiente no fundo de reserva.");

        // Update fund
        var entity = await _reserveFundRepository.FindAsync(
            f => f.CondominiumId == condominiumId && f.FiscalYear == fiscalYear);
        var fundEntity = entity.First();
        
        fundEntity.Withdrawals += amount;
        fundEntity.ClosingBalance = fundEntity.OpeningBalance + fundEntity.Deposits - fundEntity.Withdrawals;
        fundEntity.UpdatedAt = DateTime.UtcNow;
        
        _reserveFundRepository.Update(fundEntity);
        await _reserveFundRepository.SaveChangesAsync();

        // Create financial record
        var record = new FinancialRecord
        {
            Id = Guid.NewGuid(),
            Type = FinancialType.Income,
            Amount = amount,
            Description = description,
            Date = DateTime.UtcNow,
            FiscalYear = fiscalYear,
            Category = FinancialCategory.ReserveFundWithdrawal,
            CondominiumId = condominiumId
        };
        
        await _financialRepository.AddAsync(record);
        await _financialRepository.SaveChangesAsync();
        
        return MapToDto(fundEntity);
    }

    public async Task<List<ReserveFundDto>> GetHistoryAsync(Guid condominiumId)
    {
        var funds = await _reserveFundRepository.FindAsync(f => f.CondominiumId == condominiumId);
        return funds.OrderByDescending(f => f.FiscalYear).Select(MapToDto).ToList();
    }

    private async Task<ReserveFundDto> GetOrCreateYearAsync(Guid condominiumId, int fiscalYear)
    {
        var existing = await GetByYearAsync(condominiumId, fiscalYear);
        if (existing != null)
            return existing;

        var previousYear = await GetByYearAsync(condominiumId, fiscalYear - 1);
        var openingBalance = previousYear?.ClosingBalance ?? 0;

        var fund = new ReserveFund
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            FiscalYear = fiscalYear,
            OpeningBalance = openingBalance,
            Deposits = 0,
            Withdrawals = 0,
            ClosingBalance = openingBalance,
            CreatedAt = DateTime.UtcNow
        };

        await _reserveFundRepository.AddAsync(fund);
        await _reserveFundRepository.SaveChangesAsync();
        
        return MapToDto(fund);
    }

    private static ReserveFundDto MapToDto(ReserveFund f) => new()
    {
        Id = f.Id,
        CondominiumId = f.CondominiumId,
        FiscalYear = f.FiscalYear,
        OpeningBalance = f.OpeningBalance,
        Deposits = f.Deposits,
        Withdrawals = f.Withdrawals,
        ClosingBalance = f.ClosingBalance,
        CreatedAt = f.CreatedAt,
        UpdatedAt = f.UpdatedAt
    };
}

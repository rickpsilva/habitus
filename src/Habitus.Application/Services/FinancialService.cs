using Habitus.Application.DTOs.Financial;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class FinancialService
{
    private readonly IRepository<FinancialRecord> _repository;

    public FinancialService(IRepository<FinancialRecord> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<FinancialRecordDto>> GetAllAsync()
    {
        var items = await _repository.GetAllAsync();
        return items.Select(MapToDto);
    }

    public async Task<FinancialRecordDto?> GetByIdAsync(Guid id)
    {
        var item = await _repository.GetByIdAsync(id);
        return item == null ? null : MapToDto(item);
    }

    public async Task<FinancialRecordDto> CreateAsync(CreateFinancialRecordRequest request)
    {
        var entity = new FinancialRecord
        {
            Id = Guid.NewGuid(),
            Type = Enum.Parse<FinancialType>(request.Type),
            Amount = request.Amount,
            Description = request.Description,
            Date = request.Date,
            Category = request.Category,
            BuildingId = request.BuildingId,
            ReceiptUrl = request.ReceiptUrl
        };
        await _repository.AddAsync(entity);
        await _repository.SaveChangesAsync();
        return MapToDto(entity);
    }

    public async Task<FinancialSummaryDto> GetSummaryAsync(Guid buildingId)
    {
        var records = await _repository.FindAsync(r => r.BuildingId == buildingId);
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

    private static FinancialRecordDto MapToDto(FinancialRecord r) => new()
    {
        Id = r.Id,
        Type = r.Type.ToString(),
        Amount = r.Amount,
        Description = r.Description,
        Date = r.Date,
        Category = r.Category,
        BuildingId = r.BuildingId,
        ReceiptUrl = r.ReceiptUrl
    };
}

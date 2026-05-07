using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Units;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/units")]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly IRepository<Unit> _repository;
    public UnitsController(IRepository<Unit> repository) => _repository = repository;

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll() => Ok(await _repository.GetAllAsync());

    [HttpGet("paged")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        
        var units = await _repository.GetAllAsync();
        var ordered = units.OrderBy(u => u.Number);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            ordered = ordered.Where(u =>
                u.Number.ToLower().Contains(searchLower) ||
                (u.ApartmentNumber ?? "").ToLower().Contains(searchLower)
            ).OrderBy(u => u.Number);
        }
        
        return Ok(PaginationHelper.Paginate(ordered, page, pageSize));
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _repository.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateUnitRequest request)
    {
        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            CondominiumId = request.CondominiumId,
            Number = request.Number,
            Floor = request.Floor,
            Type = request.Type,
            ApartmentNumber = request.ApartmentNumber,
            Permillage = request.Permillage,
            MonthlyQuota = request.MonthlyQuota
        };
        
        await _repository.AddAsync(unit);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = unit.Id }, unit);
    }

    [HttpPost("import-csv")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> ImportCsv([FromQuery] Guid condominiumId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Ficheiro CSV não fornecido." });

        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Apenas ficheiros CSV são aceites." });

        var existingUnits = await _repository.GetAllAsync();
        var condominiumUnits = existingUnits.Where(u => u.CondominiumId == condominiumId).ToList();

        var created = 0;
        var skipped = 0;
        var errors = new List<string>();

        using var reader = new System.IO.StreamReader(file.OpenReadStream());
        var lineNumber = 0;

        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            lineNumber++;

            // Skip header line
            if (lineNumber == 1) continue;
            if (string.IsNullOrWhiteSpace(line)) continue;

            var columns = line.Split(',');
            if (columns.Length < 2)
            {
                errors.Add($"Linha {lineNumber}: formato inválido (são necessários pelo menos 'piso' e 'fração').");
                continue;
            }

            if (!int.TryParse(columns[0].Trim(), out var floor))
            {
                errors.Add($"Linha {lineNumber}: piso inválido '{columns[0].Trim()}'.");
                continue;
            }

            var number = columns[1].Trim();
            if (string.IsNullOrWhiteSpace(number))
            {
                errors.Add($"Linha {lineNumber}: número de fração vazio.");
                continue;
            }

            // Check if fraction already exists (same floor + number + condominium)
            var alreadyExists = condominiumUnits.Any(u =>
                u.Floor == floor &&
                string.Equals(u.Number, number, StringComparison.OrdinalIgnoreCase));

            if (alreadyExists)
            {
                skipped++;
                continue;
            }

            // Parse optional columns
            var unitType = UnitType.Apartment;
            if (columns.Length > 2 && !string.IsNullOrWhiteSpace(columns[2]))
            {
                if (Enum.TryParse<UnitType>(columns[2].Trim(), true, out var parsedType))
                    unitType = parsedType;
            }

            var apartmentNumber = columns.Length > 3 ? columns[3].Trim() : null;

            decimal permillage = 0;
            if (columns.Length > 4 && !string.IsNullOrWhiteSpace(columns[4]))
                decimal.TryParse(columns[4].Trim(), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out permillage);

            decimal monthlyQuota = 0;
            if (columns.Length > 5 && !string.IsNullOrWhiteSpace(columns[5]))
                decimal.TryParse(columns[5].Trim(), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out monthlyQuota);

            var unit = new Unit
            {
                Id = Guid.NewGuid(),
                CondominiumId = condominiumId,
                Floor = floor,
                Number = number,
                Type = unitType,
                ApartmentNumber = string.IsNullOrWhiteSpace(apartmentNumber) ? null : apartmentNumber,
                Permillage = permillage,
                MonthlyQuota = monthlyQuota
            };

            await _repository.AddAsync(unit);
            condominiumUnits.Add(unit);
            created++;
        }

        if (created > 0)
            await _repository.SaveChangesAsync();

        return Ok(new
        {
            message = $"{created} fração(ões) importada(s), {skipped} ignorada(s) por já existirem.",
            created,
            skipped,
            errors
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateUnitRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) return NotFound();
        
        existing.CondominiumId = request.CondominiumId;
        existing.Number = request.Number;
        existing.Floor = request.Floor;
        existing.Type = request.Type;
        existing.ApartmentNumber = request.ApartmentNumber;
        existing.Permillage = request.Permillage;
        existing.MonthlyQuota = request.MonthlyQuota;
        
        _repository.Update(existing);
        await _repository.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return NotFound();
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return NoContent();
    }
}

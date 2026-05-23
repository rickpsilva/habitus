using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Units;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/[controller]")]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly IRepository<Unit> _repository;
    public UnitsController(IRepository<Unit> repository) => _repository = repository;

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        if (role == "Manager") return true;

        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
        return Guid.TryParse(userCondominiumId, out var userCondominiumGuid) && userCondominiumGuid == condominiumId;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Resident")]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var units = await _repository.GetAllAsync();
        return Ok(units.Where(u => u.CondominiumId == condominiumId));
    }

    [HttpGet("paged")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetPaged([FromRoute] Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        
        var units = await _repository.GetAllAsync();
        var ordered = units
            .Where(u => u.CondominiumId == condominiumId)
            .OrderBy(u => u.Number);
        
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
    [Authorize(Roles = "Admin,Resident")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var result = await _repository.GetByIdAsync(id);
        if (result != null && result.CondominiumId != condominiumId) return NotFound();
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateUnitRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (request.CondominiumId != Guid.Empty && request.CondominiumId != condominiumId)
            return BadRequest(new { message = "O condominiumId no corpo do pedido não coincide com o da rota." });

        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Number = request.Number,
            Building = string.IsNullOrWhiteSpace(request.Building) ? null : request.Building.Trim(),
            Floor = request.Floor,
            Type = request.Type,
            ApartmentNumber = request.ApartmentNumber,
            Permillage = request.Permillage,
            MonthlyQuota = request.MonthlyQuota
        };
        
        await _repository.AddAsync(unit);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { condominiumId, id = unit.Id }, unit);
    }

    [HttpPost("import-csv")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ImportCsv([FromRoute] Guid condominiumId, IFormFile file)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Ficheiro CSV não fornecido." });

        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Apenas ficheiros CSV são aceites." });

        var existingUnits = await _repository.GetAllAsync();
        var condominiumUnits = existingUnits.Where(u => u.CondominiumId == condominiumId).ToList();

        var created = 0;
        var updated = 0;
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

            // Upsert key: same floor + number + condominium
            var existingUnit = condominiumUnits.FirstOrDefault(u =>
                u.Floor == floor &&
                string.Equals(u.Number, number, StringComparison.OrdinalIgnoreCase));

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

            var building = columns.Length > 6 ? columns[6].Trim() : null;

            if (existingUnit != null)
            {
                existingUnit.Type = unitType;
                existingUnit.ApartmentNumber = string.IsNullOrWhiteSpace(apartmentNumber) ? null : apartmentNumber;
                existingUnit.Permillage = permillage;
                existingUnit.MonthlyQuota = monthlyQuota;
                existingUnit.Building = string.IsNullOrWhiteSpace(building) ? null : building;
                _repository.Update(existingUnit);
                updated++;
                continue;
            }

            var unit = new Unit
            {
                Id = Guid.NewGuid(),
                CondominiumId = condominiumId,
                Floor = floor,
                Number = number,
                Building = string.IsNullOrWhiteSpace(building) ? null : building,
                Type = unitType,
                ApartmentNumber = string.IsNullOrWhiteSpace(apartmentNumber) ? null : apartmentNumber,
                Permillage = permillage,
                MonthlyQuota = monthlyQuota
            };

            await _repository.AddAsync(unit);
            condominiumUnits.Add(unit);
            created++;
        }

        if (created > 0 || updated > 0)
            await _repository.SaveChangesAsync();

        return Ok(new
        {
            message = $"{created} fração(ões) criada(s), {updated} atualizada(s).",
            created,
            updated,
            errors
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] CreateUnitRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) return NotFound();
        if (existing.CondominiumId != condominiumId) return NotFound();
        if (request.CondominiumId != Guid.Empty && request.CondominiumId != condominiumId)
            return BadRequest(new { message = "O condominiumId no corpo do pedido não coincide com o da rota." });
        
        existing.CondominiumId = condominiumId;
        existing.Number = request.Number;
        existing.Building = string.IsNullOrWhiteSpace(request.Building) ? null : request.Building.Trim();
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
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return NotFound();
        if (entity.CondominiumId != condominiumId) return NotFound();
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return NoContent();
    }
}

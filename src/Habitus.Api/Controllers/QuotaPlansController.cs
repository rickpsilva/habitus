using Habitus.Application.DTOs.Financial;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/quota-plans")]
[Authorize(Roles = "Manager,Admin")]
public class QuotaPlansController : ControllerBase
{
    private readonly IRepository<QuotaPlan> _quotaPlanRepository;
    private readonly IRepository<QuotaCalculation> _calculationRepository;
    private readonly IRepository<Unit> _unitRepository;
    private readonly ILogger<QuotaPlansController> _logger;

    public QuotaPlansController(
        IRepository<QuotaPlan> quotaPlanRepository,
        IRepository<QuotaCalculation> calculationRepository,
        IRepository<Unit> unitRepository,
        ILogger<QuotaPlansController> logger)
    {
        _quotaPlanRepository = quotaPlanRepository;
        _calculationRepository = calculationRepository;
        _unitRepository = unitRepository;
        _logger = logger;
    }

    // GET: api/condominiums/{condominiumId:guid}/quota-plans
    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        try
        {
            var plans = await _quotaPlanRepository.GetAllAsync();
            var condoPlans = plans
                .Where(p => p.CondominiumId == condominiumId)
                .OrderByDescending(p => p.Year)
                .ToList();

            var dtos = condoPlans.Select(p => new QuotaPlanDto
            {
                Id = p.Id,
                CondominiumId = p.CondominiumId,
                Year = p.Year,
                InflationRate = p.InflationRate,
                ExtraordinaryQuota = p.ExtraordinaryQuota,
                Status = p.Status.ToString(),
                CreatedAt = p.CreatedAt,
                AppliedAt = p.AppliedAt,
                AppliedBy = p.AppliedBy
            }).ToList();

            return Ok(dtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting quota plans for condominium {CondominiumId}", condominiumId);
            return StatusCode(500, new { message = "Erro ao carregar planos de quotas" });
        }
    }

    // GET: api/condominiums/{condominiumId:guid}/quota-plans/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        try
        {
            var plan = await _quotaPlanRepository.GetByIdAsync(id);
            if (plan == null || plan.CondominiumId != condominiumId)
            {
                return NotFound(new { message = "Plano de quotas não encontrado" });
            }

            // Load calculations with units
            var calculations = await _calculationRepository.GetAllAsync();
            var planCalculations = calculations
                .Where(c => c.QuotaPlanId == id)
                .ToList();

            var units = await _unitRepository.GetAllAsync();
            var unitDict = units.ToDictionary(u => u.Id, u => u);

            var dto = new QuotaPlanDto
            {
                Id = plan.Id,
                CondominiumId = plan.CondominiumId,
                Year = plan.Year,
                InflationRate = plan.InflationRate,
                ExtraordinaryQuota = plan.ExtraordinaryQuota,
                Status = plan.Status.ToString(),
                CreatedAt = plan.CreatedAt,
                AppliedAt = plan.AppliedAt,
                AppliedBy = plan.AppliedBy,
                Calculations = planCalculations.Select(c => new QuotaCalculationDto
                {
                    Id = c.Id,
                    UnitId = c.UnitId,
                    UnitNumber = unitDict.ContainsKey(c.UnitId) ? unitDict[c.UnitId].Number : "",
                    BaseMonthlyQuota = c.BaseMonthlyQuota,
                    InflationAmount = c.InflationAmount,
                    MonthlyQuota = c.MonthlyQuota,
                    QuarterlyQuota = c.QuarterlyQuota,
                    AnnualQuota = c.AnnualQuota
                }).OrderBy(c => c.UnitNumber).ToList()
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting quota plan {Id}", id);
            return StatusCode(500, new { message = "Erro ao carregar plano de quotas" });
        }
    }

    // POST: api/condominiums/{condominiumId:guid}/quota-plans
    [HttpPost]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateQuotaPlanRequest request)
    {
        try
        {
            // Check if plan for this year already exists
            var existingPlans = await _quotaPlanRepository.GetAllAsync();
            var existingPlan = existingPlans.FirstOrDefault(p => 
                p.CondominiumId == condominiumId && p.Year == request.Year);

            if (existingPlan != null)
            {
                return BadRequest(new { message = $"Já existe um plano para o ano {request.Year}" });
            }

            // Create new plan
            var plan = new QuotaPlan
            {
                Id = Guid.NewGuid(),
                CondominiumId = condominiumId,
                Year = request.Year,
                InflationRate = request.InflationRate,
                ExtraordinaryQuota = request.ExtraordinaryQuota,
                Status = QuotaPlanStatus.Draft,
                CreatedAt = DateTime.UtcNow
            };

            await _quotaPlanRepository.AddAsync(plan);

            // Generate calculations for all units
            await GenerateCalculations(plan);

            await _quotaPlanRepository.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { condominiumId, id = plan.Id }, 
                await GetPlanDto(plan));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating quota plan");
            return StatusCode(500, new { message = "Erro ao criar plano de quotas" });
        }
    }

    // PUT: api/condominiums/{condominiumId:guid}/quota-plans/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateQuotaPlanRequest request)
    {
        try
        {
            var plan = await _quotaPlanRepository.GetByIdAsync(id);
            if (plan == null || plan.CondominiumId != condominiumId)
            {
                return NotFound(new { message = "Plano de quotas não encontrado" });
            }

            if (plan.Status == QuotaPlanStatus.Applied)
            {
                return BadRequest(new { message = "Não é possível editar um plano já aplicado" });
            }

            // Update plan
            plan.InflationRate = request.InflationRate;
            plan.ExtraordinaryQuota = request.ExtraordinaryQuota;

            _quotaPlanRepository.Update(plan);

            // Regenerate calculations
            var existingCalculations = await _calculationRepository.GetAllAsync();
            var toRemove = existingCalculations.Where(c => c.QuotaPlanId == id).ToList();
            foreach (var calc in toRemove)
            {
                _calculationRepository.Remove(calc);
            }

            await GenerateCalculations(plan);
            await _quotaPlanRepository.SaveChangesAsync();

            return Ok(await GetPlanDto(plan));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating quota plan {Id}", id);
            return StatusCode(500, new { message = "Erro ao atualizar plano de quotas" });
        }
    }

    // POST: api/condominiums/{condominiumId:guid}/quota-plans/{id}/apply
    [HttpPost("{id}/apply")]
    public async Task<IActionResult> ApplyPlan([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        try
        {
            var plan = await _quotaPlanRepository.GetByIdAsync(id);
            if (plan == null || plan.CondominiumId != condominiumId)
            {
                return NotFound(new { message = "Plano de quotas não encontrado" });
            }

            if (plan.Status == QuotaPlanStatus.Applied)
            {
                return BadRequest(new { message = "Este plano já foi aplicado" });
            }

            // Get calculations
            var calculations = await _calculationRepository.GetAllAsync();
            var planCalculations = calculations.Where(c => c.QuotaPlanId == id).ToList();

            // Update monthly quota for each unit
            foreach (var calc in planCalculations)
            {
                var unit = await _unitRepository.GetByIdAsync(calc.UnitId);
                if (unit != null)
                {
                    unit.MonthlyQuota = calc.MonthlyQuota;
                    _unitRepository.Update(unit);
                }
            }

            // Update plan status
            plan.Status = QuotaPlanStatus.Applied;
            plan.AppliedAt = DateTime.UtcNow;
            plan.AppliedBy = User.Identity?.Name ?? "System";
            _quotaPlanRepository.Update(plan);

            // Archive other plans for the same year
            var allPlans = await _quotaPlanRepository.GetAllAsync();
            var otherPlans = allPlans.Where(p => 
                p.CondominiumId == condominiumId && 
                p.Year == plan.Year && 
                p.Id != id &&
                p.Status != QuotaPlanStatus.Archived).ToList();

            foreach (var other in otherPlans)
            {
                other.Status = QuotaPlanStatus.Archived;
                _quotaPlanRepository.Update(other);
            }

            await _quotaPlanRepository.SaveChangesAsync();

            _logger.LogInformation("Applied quota plan {PlanId} for year {Year}", id, plan.Year);
            return Ok(new { message = $"Plano de quotas {plan.Year} aplicado com sucesso" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error applying quota plan {Id}", id);
            return StatusCode(500, new { message = "Erro ao aplicar plano de quotas" });
        }
    }

    // DELETE: api/condominiums/{condominiumId:guid}/quota-plans/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        try
        {
            var plan = await _quotaPlanRepository.GetByIdAsync(id);
            if (plan == null || plan.CondominiumId != condominiumId)
            {
                return NotFound(new { message = "Plano de quotas não encontrado" });
            }

            if (plan.Status == QuotaPlanStatus.Applied)
            {
                return BadRequest(new { message = "Não é possível eliminar um plano já aplicado" });
            }

            // Remove calculations
            var calculations = await _calculationRepository.GetAllAsync();
            var toRemove = calculations.Where(c => c.QuotaPlanId == id).ToList();
            foreach (var calc in toRemove)
            {
                _calculationRepository.Remove(calc);
            }

            _quotaPlanRepository.Remove(plan);
            await _quotaPlanRepository.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting quota plan {Id}", id);
            return StatusCode(500, new { message = "Erro ao eliminar plano de quotas" });
        }
    }

    // Helper methods
    private async Task GenerateCalculations(QuotaPlan plan)
    {
        var units = await _unitRepository.GetAllAsync();
        var condoUnits = units.Where(u => u.CondominiumId == plan.CondominiumId).ToList();

        foreach (var unit in condoUnits)
        {
            var baseMonthly = unit.MonthlyQuota;
            var inflationAmount = baseMonthly * (plan.InflationRate / 100);
            var monthlyWithInflation = baseMonthly + inflationAmount;
            var monthlyTotal = monthlyWithInflation + (plan.ExtraordinaryQuota / 12);

            var calculation = new QuotaCalculation
            {
                Id = Guid.NewGuid(),
                QuotaPlanId = plan.Id,
                UnitId = unit.Id,
                BaseMonthlyQuota = baseMonthly,
                InflationAmount = inflationAmount,
                MonthlyQuota = monthlyTotal,
                QuarterlyQuota = monthlyTotal * 3,
                AnnualQuota = monthlyTotal * 12
            };

            await _calculationRepository.AddAsync(calculation);
        }
    }

    private async Task<QuotaPlanDto> GetPlanDto(QuotaPlan plan)
    {
        var calculations = await _calculationRepository.GetAllAsync();
        var planCalculations = calculations.Where(c => c.QuotaPlanId == plan.Id).ToList();

        var units = await _unitRepository.GetAllAsync();
        var unitDict = units.ToDictionary(u => u.Id, u => u);

        return new QuotaPlanDto
        {
            Id = plan.Id,
            CondominiumId = plan.CondominiumId,
            Year = plan.Year,
            InflationRate = plan.InflationRate,
            ExtraordinaryQuota = plan.ExtraordinaryQuota,
            Status = plan.Status.ToString(),
            CreatedAt = plan.CreatedAt,
            AppliedAt = plan.AppliedAt,
            AppliedBy = plan.AppliedBy,
            Calculations = planCalculations.Select(c => new QuotaCalculationDto
            {
                Id = c.Id,
                UnitId = c.UnitId,
                UnitNumber = unitDict.ContainsKey(c.UnitId) ? unitDict[c.UnitId].Number : "",
                BaseMonthlyQuota = c.BaseMonthlyQuota,
                InflationAmount = c.InflationAmount,
                MonthlyQuota = c.MonthlyQuota,
                QuarterlyQuota = c.QuarterlyQuota,
                AnnualQuota = c.AnnualQuota
            }).OrderBy(c => c.UnitNumber).ToList()
        };
    }
}

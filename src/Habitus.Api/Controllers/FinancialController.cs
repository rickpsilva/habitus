using Habitus.Application.DTOs.Financial;
using Habitus.Application.Services;
using Habitus.Api.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/financial")]
[Authorize(Roles = "Admin,Resident")]
[RequireFeature("financial")]
public class FinancialController : ControllerBase
{
    private readonly FinancialService _service;
    private readonly ReserveFundService _reserveFundService;

    public FinancialController(FinancialService service, ReserveFundService reserveFundService)
    {
        _service = service;
        _reserveFundService = reserveFundService;
    }

    // Unbounded full listing is Admin-only; Residents use the paged endpoints (paged / by-year).
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        return Ok(await _service.GetAllAsync(condominiumId));
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromRoute] Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        return Ok(await _service.GetPagedAsync(page, pageSize, condominiumId, search));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        var result = await _service.GetByIdAsync(id, condominiumId);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromRoute] Guid condominiumId)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        return Ok(await _service.GetSummaryAsync(condominiumId));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateFinancialRecordRequest request)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        if (request.CondominiumId != condominiumId)
            return Forbid();

        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { message = "Dados inválidos", errors = ModelState });
            }
            
            var result = await _service.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { condominiumId, id = result.Id }, result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, details = ex.InnerException?.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        var success = await _service.DeleteAsync(id, condominiumId);
        return success ? NoContent() : NotFound();
    }

    // Dashboard with fiscal year filtering
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard([FromRoute] Guid condominiumId, [FromQuery] int? fiscalYear = null)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        return Ok(await _service.GetDashboardAsync(condominiumId, fiscalYear));
    }

    // Get available fiscal years
    [HttpGet("fiscal-years")]
    public async Task<IActionResult> GetFiscalYears([FromRoute] Guid condominiumId)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        return Ok(await _service.GetAvailableFiscalYearsAsync(condominiumId));
    }

    // Get records by fiscal year
    [HttpGet("by-year")]
    public async Task<IActionResult> GetByYear(
        [FromRoute] Guid condominiumId,
        [FromQuery] int fiscalYear, 
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 10, 
        [FromQuery] string? search = null,
        [FromQuery] string? type = null)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        return Ok(await _service.GetPagedByYearAsync(condominiumId, fiscalYear, page, pageSize, search, type));
    }

    // Reserve Fund endpoints
    [HttpGet("reserve-fund")]
    public async Task<IActionResult> GetReserveFund([FromRoute] Guid condominiumId, [FromQuery] int? fiscalYear = null)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        var year = fiscalYear ?? DateTime.UtcNow.Year;
        var fund = await _reserveFundService.GetByYearAsync(condominiumId, year);
        return fund == null ? NotFound() : Ok(fund);
    }

    [HttpGet("reserve-fund/current")]
    public async Task<IActionResult> GetCurrentReserveFund([FromRoute] Guid condominiumId)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        return Ok(await _reserveFundService.GetOrCreateCurrentYearAsync(condominiumId));
    }

    [HttpGet("reserve-fund/history")]
    public async Task<IActionResult> GetReserveFundHistory([FromRoute] Guid condominiumId)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        return Ok(await _reserveFundService.GetHistoryAsync(condominiumId));
    }

    [HttpPost("reserve-fund/deposit")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddDeposit(
        [FromRoute] Guid condominiumId,
        [FromBody] UpdateReserveFundRequest request)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        if (!request.Deposits.HasValue || request.Deposits.Value <= 0)
            return BadRequest(new { message = "Valor de depósito inválido" });

        var year = DateTime.UtcNow.Year;
        var result = await _reserveFundService.AddDepositAsync(
            condominiumId, 
            year, 
            request.Deposits.Value, 
            "Transferência para fundo de reserva");
        
        return Ok(result);
    }

    [HttpPost("reserve-fund/withdrawal")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddWithdrawal(
        [FromRoute] Guid condominiumId,
        [FromBody] UpdateReserveFundRequest request)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        if (!request.Withdrawals.HasValue || request.Withdrawals.Value <= 0)
            return BadRequest(new { message = "Valor de levantamento inválido" });

        try
        {
            var year = DateTime.UtcNow.Year;
            var result = await _reserveFundService.AddWithdrawalAsync(
                condominiumId, 
                year, 
                request.Withdrawals.Value, 
                "Levantamento do fundo de reserva");
            
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private bool HasCondominiumAccess(Guid condominiumId)
    {
        var claim = User.FindFirstValue("CondominiumId");
        return Guid.TryParse(claim, out var jwtCondominiumId) && jwtCondominiumId == condominiumId;
    }
}

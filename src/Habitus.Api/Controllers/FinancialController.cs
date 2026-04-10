using Habitus.Application.DTOs.Financial;
using Habitus.Application.Services;
using Habitus.Api.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/financial")]
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

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!TryGetCondominiumId(out var condominiumId))
            return Unauthorized("User scope is invalid.");
        return Ok(await _service.GetAllAsync(condominiumId));
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!TryGetCondominiumId(out var condominiumId))
            return Unauthorized("User scope is invalid.");
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        return Ok(await _service.GetPagedAsync(page, pageSize, condominiumId, search));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetCondominiumId(out var condominiumId))
            return Unauthorized("User scope is invalid.");
        var result = await _service.GetByIdAsync(id, condominiumId);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpGet("summary/{condominiumId}")]
    public async Task<IActionResult> GetSummary(Guid condominiumId)
    {
        if (!TryGetCondominiumId(out var jwtCondominiumId) || jwtCondominiumId != condominiumId)
            return Forbid();
        return Ok(await _service.GetSummaryAsync(condominiumId));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateFinancialRecordRequest request)
    {
        if (!TryGetCondominiumId(out var condominiumId))
            return Unauthorized("User scope is invalid.");

        if (request.CondominiumId != condominiumId)
            return Forbid();

        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { message = "Dados inválidos", errors = ModelState });
            }
            
            var result = await _service.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, details = ex.InnerException?.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetCondominiumId(out var condominiumId))
            return Unauthorized("User scope is invalid.");
        var success = await _service.DeleteAsync(id, condominiumId);
        return success ? NoContent() : NotFound();
    }

    // Dashboard with fiscal year filtering
    [HttpGet("dashboard/{condominiumId}")]
    public async Task<IActionResult> GetDashboard(Guid condominiumId, [FromQuery] int? fiscalYear = null)
    {
        if (!TryGetCondominiumId(out var jwtCondominiumId) || jwtCondominiumId != condominiumId)
            return Forbid();
        return Ok(await _service.GetDashboardAsync(condominiumId, fiscalYear));
    }

    // Get available fiscal years
    [HttpGet("fiscal-years/{condominiumId}")]
    public async Task<IActionResult> GetFiscalYears(Guid condominiumId)
    {
        if (!TryGetCondominiumId(out var jwtCondominiumId) || jwtCondominiumId != condominiumId)
            return Forbid();
        return Ok(await _service.GetAvailableFiscalYearsAsync(condominiumId));
    }

    // Get records by fiscal year
    [HttpGet("by-year/{condominiumId}")]
    public async Task<IActionResult> GetByYear(
        Guid condominiumId, 
        [FromQuery] int fiscalYear, 
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 10, 
        [FromQuery] string? search = null)
    {
        if (!TryGetCondominiumId(out var jwtCondominiumId) || jwtCondominiumId != condominiumId)
            return Forbid();
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        return Ok(await _service.GetPagedByYearAsync(condominiumId, fiscalYear, page, pageSize, search));
    }

    // Reserve Fund endpoints
    [HttpGet("reserve-fund/{condominiumId}")]
    public async Task<IActionResult> GetReserveFund(Guid condominiumId, [FromQuery] int? fiscalYear = null)
    {
        if (!TryGetCondominiumId(out var jwtCondominiumId) || jwtCondominiumId != condominiumId)
            return Forbid();
        var year = fiscalYear ?? DateTime.UtcNow.Year;
        var fund = await _reserveFundService.GetByYearAsync(condominiumId, year);
        return fund == null ? NotFound() : Ok(fund);
    }

    [HttpGet("reserve-fund/{condominiumId}/current")]
    public async Task<IActionResult> GetCurrentReserveFund(Guid condominiumId)
    {
        if (!TryGetCondominiumId(out var jwtCondominiumId) || jwtCondominiumId != condominiumId)
            return Forbid();
        return Ok(await _reserveFundService.GetOrCreateCurrentYearAsync(condominiumId));
    }

    [HttpGet("reserve-fund/{condominiumId}/history")]
    public async Task<IActionResult> GetReserveFundHistory(Guid condominiumId)
    {
        if (!TryGetCondominiumId(out var jwtCondominiumId) || jwtCondominiumId != condominiumId)
            return Forbid();
        return Ok(await _reserveFundService.GetHistoryAsync(condominiumId));
    }

    [HttpPost("reserve-fund/{condominiumId}/deposit")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddDeposit(
        Guid condominiumId, 
        [FromBody] UpdateReserveFundRequest request)
    {
        if (!TryGetCondominiumId(out var jwtCondominiumId) || jwtCondominiumId != condominiumId)
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

    [HttpPost("reserve-fund/{condominiumId}/withdrawal")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddWithdrawal(
        Guid condominiumId, 
        [FromBody] UpdateReserveFundRequest request)
    {
        if (!TryGetCondominiumId(out var jwtCondominiumId) || jwtCondominiumId != condominiumId)
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

    private bool TryGetCondominiumId(out Guid condominiumId)
    {
        condominiumId = Guid.Empty;
        var claim = User.FindFirstValue("CondominiumId");
        return Guid.TryParse(claim, out condominiumId);
    }
}

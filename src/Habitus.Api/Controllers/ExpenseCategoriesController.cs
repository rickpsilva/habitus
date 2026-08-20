using Habitus.Application.DTOs.ExpenseCategory;
using Habitus.Application.Services;
using Habitus.Api.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/expense-categories")]
[Authorize(Roles = "Admin")]
public class ExpenseCategoriesController : ControllerBase
{
    private readonly ExpenseCategoryService _service;

    public ExpenseCategoriesController(ExpenseCategoryService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        return Ok(await _service.GetAllAsync(condominiumId));
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActive([FromRoute] Guid condominiumId)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        return Ok(await _service.GetActiveAsync(condominiumId));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        var result = await _service.GetByIdAsync(id, condominiumId);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateExpenseCategoryRequest request)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        if (request.CondominiumId != condominiumId)
            return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(new { message = "Dados inválidos", errors = ModelState });

        try
        {
            var result = await _service.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { condominiumId, id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateExpenseCategoryRequest request)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(new { message = "Dados inválidos", errors = ModelState });

        try
        {
            var result = await _service.UpdateAsync(id, request, condominiumId);
            return result == null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!HasCondominiumAccess(condominiumId))
            return Forbid();

        var success = await _service.DeleteAsync(id, condominiumId);
        return success ? NoContent() : NotFound();
    }

    private bool HasCondominiumAccess(Guid condominiumId)
    {
        var claim = User.FindFirstValue("CondominiumId");
        return Guid.TryParse(claim, out var jwtCondominiumId) && jwtCondominiumId == condominiumId;
    }
}

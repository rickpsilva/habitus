using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId}/useful-contacts")]
[Authorize]
public class UsefulContactsController : ControllerBase
{
    private readonly UsefulContactService _service;
    
    public UsefulContactsController(UsefulContactService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create(Guid condominiumId, [FromBody] CreateUsefulContactRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var contact = await _service.CreateAsync(condominiumId, request.Name, request.Phone, request.Category);
            return CreatedAtAction(nameof(GetById), new { condominiumId, id = contact.Id }, contact);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid condominiumId, Guid id, [FromBody] UpdateUsefulContactRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var contact = await _service.UpdateAsync(id, request.Name, request.Phone, request.Category);
            return contact == null ? NotFound() : Ok(contact);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid condominiumId, Guid id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}

public class CreateUsefulContactRequest
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public ContactCategory Category { get; set; }
}

public class UpdateUsefulContactRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public ContactCategory Category { get; set; }
}

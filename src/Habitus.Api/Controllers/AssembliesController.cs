using Habitus.Application.DTOs.Assemblies;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/assemblies")]
[Authorize]
public class AssembliesController : ControllerBase
{
    private readonly AssemblyService _service;
    private readonly IRepository<AssemblyAttendance> _attendanceRepository;
    private readonly IRepository<AssemblyDecision> _decisionRepository;

    public AssembliesController(
        AssemblyService service,
        IRepository<AssemblyAttendance> attendanceRepository,
        IRepository<AssemblyDecision> decisionRepository)
    {
        _service = service;
        _attendanceRepository = attendanceRepository;
        _decisionRepository = decisionRepository;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AssemblyDto>>> GetAll()
    {
        var result = await _service.GetAllAsync();
        return Ok(result);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        var result = await _service.GetPagedAsync(page, pageSize, search);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AssemblyDto>> GetById(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> Create([FromBody] CreateAssemblyRequest request)
    {
        var result = await _service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> Update(Guid id, [FromBody] UpdateAssemblyRequest request)
    {
        var result = await _service.UpdateAsync(id, request);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/minutes")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> UpdateMinutes(Guid id, [FromBody] UpdateMinutesRequest request)
    {
        var result = await _service.UpdateMinutesAsync(id, request);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/draft-minutes")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> UpdateMinutesDraft(Guid id, [FromBody] UpdateMinutesRequest request)
    {
        var result = await _service.UpdateMinutesDraftAsync(id, request);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/notes")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> UpdateNotes(Guid id, [FromBody] UpdateNotesRequest request)
    {
        var result = await _service.UpdateNotesAsync(id, request);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/cancel")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AssemblyDto>> Cancel(Guid id, [FromBody] CancelAssemblyRequest request)
    {
        var result = await _service.CancelAsync(id, request);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id}/attendance")]
    public async Task<IActionResult> AddAttendance(Guid id, [FromBody] AssemblyAttendance attendance)
    {
        attendance.Id = Guid.NewGuid();
        attendance.AssemblyId = id;
        attendance.ConfirmedAt = DateTime.UtcNow;
        await _attendanceRepository.AddAsync(attendance);
        await _attendanceRepository.SaveChangesAsync();
        return Ok(attendance);
    }

    [HttpPost("{id}/decisions")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddDecision(Guid id, [FromBody] AssemblyDecision decision)
    {
        decision.Id = Guid.NewGuid();
        decision.AssemblyId = id;
        decision.DecidedAt = DateTime.UtcNow;
        await _decisionRepository.AddAsync(decision);
        await _decisionRepository.SaveChangesAsync();
        return Ok(decision);
    }
}

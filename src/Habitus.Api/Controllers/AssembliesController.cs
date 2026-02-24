using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/assemblies")]
[Authorize]
public class AssembliesController : ControllerBase
{
    private readonly IRepository<Assembly> _assemblyRepository;
    private readonly IRepository<AssemblyAttendance> _attendanceRepository;
    private readonly IRepository<AssemblyDecision> _decisionRepository;

    public AssembliesController(
        IRepository<Assembly> assemblyRepository,
        IRepository<AssemblyAttendance> attendanceRepository,
        IRepository<AssemblyDecision> decisionRepository)
    {
        _assemblyRepository = assemblyRepository;
        _attendanceRepository = attendanceRepository;
        _decisionRepository = decisionRepository;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _assemblyRepository.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _assemblyRepository.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] Assembly assembly)
    {
        assembly.Id = Guid.NewGuid();
        await _assemblyRepository.AddAsync(assembly);
        await _assemblyRepository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = assembly.Id }, assembly);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] Assembly assembly)
    {
        var existing = await _assemblyRepository.GetByIdAsync(id);
        if (existing == null) return NotFound();
        existing.Title = assembly.Title;
        existing.Description = assembly.Description;
        existing.ScheduledAt = assembly.ScheduledAt;
        existing.Status = assembly.Status;
        _assemblyRepository.Update(existing);
        await _assemblyRepository.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entity = await _assemblyRepository.GetByIdAsync(id);
        if (entity == null) return NotFound();
        _assemblyRepository.Remove(entity);
        await _assemblyRepository.SaveChangesAsync();
        return NoContent();
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

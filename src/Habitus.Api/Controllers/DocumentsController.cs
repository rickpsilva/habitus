using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private readonly IRepository<Document> _repository;
    private readonly IBlobStorageService _blobStorage;

    public DocumentsController(IRepository<Document> repository, IBlobStorageService blobStorage)
    {
        _repository = repository;
        _blobStorage = blobStorage;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _repository.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _repository.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] Document document)
    {
        document.Id = Guid.NewGuid();
        document.UploadedAt = DateTime.UtcNow;
        await _repository.AddAsync(document);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = document.Id }, document);
    }

    [HttpPost("upload")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Upload(IFormFile file, [FromQuery] Guid buildingId, [FromQuery] string name, [FromQuery] string type, [FromQuery] Guid uploadedBy)
    {
        using var stream = file.OpenReadStream();
        var url = await _blobStorage.UploadAsync(stream, file.FileName, file.ContentType);
        var document = new Document
        {
            Id = Guid.NewGuid(),
            Name = name,
            Type = Enum.Parse<DocumentType>(type),
            Url = url,
            UploadedAt = DateTime.UtcNow,
            UploadedBy = uploadedBy,
            BuildingId = buildingId
        };
        await _repository.AddAsync(document);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = document.Id }, document);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);
        if (entity == null) return NotFound();
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return NoContent();
    }
}

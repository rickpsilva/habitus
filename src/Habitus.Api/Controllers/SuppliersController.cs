using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Suppliers;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/[controller]")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly IRepository<Supplier> _repository;
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<SuppliersController> _logger;

    public SuppliersController(IRepository<Supplier> repository, IEncryptionService encryptionService, ILogger<SuppliersController> logger)
    {
        _repository = repository;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        if (role == "Manager") return true;

        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
        return Guid.TryParse(userCondominiumId, out var userCondominiumGuid) && userCondominiumGuid == condominiumId;
    }

    private SupplierDto MapToDto(Supplier supplier)
    {
        string? email = string.IsNullOrEmpty(supplier.EmailEncrypted)
            ? supplier.Email
            : DecryptIfPresent(supplier.EmailEncrypted);

        string? phone = string.IsNullOrEmpty(supplier.PhoneEncrypted)
            ? supplier.Phone
            : DecryptIfPresent(supplier.PhoneEncrypted);

        string? address = string.IsNullOrEmpty(supplier.AddressEncrypted)
            ? supplier.Address
            : DecryptIfPresent(supplier.AddressEncrypted);

        return new SupplierDto
        {
            Id = supplier.Id.ToString(),
            Name = supplier.Name,
            Email = email ?? string.Empty,
            Phone = phone ?? string.Empty,
            Address = address ?? string.Empty,
            Specialty = supplier.Specialty,
            IsActive = supplier.IsActive,
            CondominiumId = supplier.CondominiumId.ToString()
        };
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var suppliers = await _repository.FindAsync(s => s.CondominiumId == condominiumId);
        var dtos = suppliers.Select(MapToDto);
        return Ok(dtos);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged([FromRoute] Guid condominiumId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        
        var suppliers = await _repository.FindAsync(s => s.CondominiumId == condominiumId);
        var dtos = suppliers.Select(MapToDto).OrderBy(s => s.Name);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(s =>
                s.Name.ToLower().Contains(searchLower) ||
                (s.Email ?? "").ToLower().Contains(searchLower) ||
                (s.Specialty ?? "").ToLower().Contains(searchLower)
            ).OrderBy(s => s.Name);
        }
        
        return Ok(PaginationHelper.Paginate(dtos, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var supplier = await _repository.GetByIdAsync(id);
        if (supplier == null || supplier.CondominiumId != condominiumId) return NotFound();

        return Ok(MapToDto(supplier));
    }

    [HttpPost]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateSupplierRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (!string.IsNullOrWhiteSpace(request.CondominiumId)
            && Guid.TryParse(request.CondominiumId, out var requestCondominiumId)
            && requestCondominiumId != condominiumId)
        {
            return BadRequest(new { message = "O condominiumId no corpo do pedido não coincide com o da rota." });
        }

        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Email = string.Empty,
            EmailEncrypted = EncryptIfPresent(request.Email),
            Phone = string.Empty,
            PhoneEncrypted = EncryptIfPresent(request.Phone),
            Address = string.Empty,
            AddressEncrypted = EncryptIfPresent(request.Address),
            Specialty = request.Specialty,
            CondominiumId = condominiumId,
            IsActive = true
        };
        
        await _repository.AddAsync(supplier);
        await _repository.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { condominiumId, id = supplier.Id }, MapToDto(supplier));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateSupplierRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var existing = await _repository.GetByIdAsync(id);
        if (existing == null || existing.CondominiumId != condominiumId) return NotFound();
        
        existing.Name = request.Name;
        existing.EmailEncrypted = EncryptIfPresent(request.Email);
        existing.Email = string.Empty;
        existing.PhoneEncrypted = EncryptIfPresent(request.Phone);
        existing.Phone = string.Empty;
        existing.AddressEncrypted = EncryptIfPresent(request.Address);
        existing.Address = string.Empty;
        existing.Specialty = request.Specialty;
        existing.IsActive = request.IsActive;
        
        _repository.Update(existing);
        await _repository.SaveChangesAsync();

        return Ok(MapToDto(existing));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var entity = await _repository.GetByIdAsync(id);
        if (entity == null || entity.CondominiumId != condominiumId) return NotFound();
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return NoContent();
    }

    private string? EncryptIfPresent(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return _encryptionService.Encrypt(value.Trim());
    }

    private string? DecryptIfPresent(string? encryptedValue)
    {
        if (string.IsNullOrWhiteSpace(encryptedValue)) return null;

        try
        {
            return _encryptionService.Decrypt(encryptedValue);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Unable to decrypt supplier field. Returning null.");
            return null;
        }
    }
}

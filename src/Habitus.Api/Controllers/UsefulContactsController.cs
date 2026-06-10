using Habitus.Application.Interfaces;
using Habitus.Api.Middleware;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/condominiums/{condominiumId:guid}/useful-contacts")]
[Authorize(Roles = "Admin,Resident")]
[RequireFeature("useful_contacts")]
public class UsefulContactsController : ControllerBase
{
    public sealed class CreateUsefulContactRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? PostalCode { get; set; }
        public string? Locality { get; set; }
        public ContactCategory Category { get; set; }
        public Guid? CondominiumId { get; set; }
    }

    public sealed class UpdateUsefulContactRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? PostalCode { get; set; }
        public string? Locality { get; set; }
        public ContactCategory Category { get; set; }
    }

    private readonly IRepository<UsefulContact> _repository;
    private readonly IEncryptionService _encryptionService;
    
    public UsefulContactsController(IRepository<UsefulContact> repository, IEncryptionService encryptionService)
    {
        _repository = repository;
        _encryptionService = encryptionService;
    }

    private bool CanAccessCondominium(Guid condominiumId)
    {
        var userCondominiumId = User.FindFirst("CondominiumId")?.Value;
        return Guid.TryParse(userCondominiumId, out var userCondominiumGuid) && userCondominiumGuid == condominiumId;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] Guid condominiumId)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var contacts = await _repository.FindAsync(c => c.CondominiumId == condominiumId);
        return Ok(contacts.Select(MapContact).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var result = await _repository.GetByIdAsync(id);
        if (result != null && result.CondominiumId != condominiumId) return NotFound();
        return result == null ? NotFound() : Ok(MapContact(result));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromRoute] Guid condominiumId, [FromBody] CreateUsefulContactRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        if (request.CondominiumId.HasValue && request.CondominiumId.Value != condominiumId)
            return BadRequest(new { message = "O condominiumId no corpo do pedido não coincide com o da rota." });

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
            return BadRequest(new { message = "Nome e telefone são obrigatórios." });

        var contact = new UsefulContact
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Name = request.Name.Trim(),
            PhoneEncrypted = _encryptionService.Encrypt(request.Phone.Trim()),
            EmailEncrypted = !string.IsNullOrWhiteSpace(request.Email) ? _encryptionService.Encrypt(request.Email.Trim()) : null,
            AddressEncrypted = !string.IsNullOrWhiteSpace(request.Address) ? _encryptionService.Encrypt(request.Address.Trim()) : null,
            PostalCodeEncrypted = !string.IsNullOrWhiteSpace(request.PostalCode) ? _encryptionService.Encrypt(request.PostalCode.Trim()) : null,
            LocalityEncrypted = !string.IsNullOrWhiteSpace(request.Locality) ? _encryptionService.Encrypt(request.Locality.Trim()) : null,
            Category = request.Category,
        };

        await _repository.AddAsync(contact);
        await _repository.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { condominiumId, id = contact.Id }, MapContact(contact));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update([FromRoute] Guid condominiumId, [FromRoute] Guid id, [FromBody] UpdateUsefulContactRequest request)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var existing = await _repository.GetByIdAsync(id);
        if (existing == null || existing.CondominiumId != condominiumId) return NotFound();

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
            return BadRequest(new { message = "Nome e telefone são obrigatórios." });

        existing.Name = request.Name.Trim();
        existing.PhoneEncrypted = _encryptionService.Encrypt(request.Phone.Trim());
        existing.EmailEncrypted = !string.IsNullOrWhiteSpace(request.Email) ? _encryptionService.Encrypt(request.Email.Trim()) : null;
        existing.AddressEncrypted = !string.IsNullOrWhiteSpace(request.Address) ? _encryptionService.Encrypt(request.Address.Trim()) : null;
        existing.PostalCodeEncrypted = !string.IsNullOrWhiteSpace(request.PostalCode) ? _encryptionService.Encrypt(request.PostalCode.Trim()) : null;
        existing.LocalityEncrypted = !string.IsNullOrWhiteSpace(request.Locality) ? _encryptionService.Encrypt(request.Locality.Trim()) : null;
        existing.Category = request.Category;
        _repository.Update(existing);
        await _repository.SaveChangesAsync();
        return Ok(MapContact(existing));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete([FromRoute] Guid condominiumId, [FromRoute] Guid id)
    {
        if (!CanAccessCondominium(condominiumId)) return Forbid();

        var entity = await _repository.GetByIdAsync(id);
        if (entity == null || entity.CondominiumId != condominiumId) return NotFound();
        _repository.Remove(entity);
        await _repository.SaveChangesAsync();
        return NoContent();
    }

    private object MapContact(UsefulContact contact)
    {
        var phone = !string.IsNullOrEmpty(contact.PhoneEncrypted) ? _encryptionService.Decrypt(contact.PhoneEncrypted) : contact.Phone;
        var email = !string.IsNullOrEmpty(contact.EmailEncrypted) ? _encryptionService.Decrypt(contact.EmailEncrypted) : null;
        var address = !string.IsNullOrEmpty(contact.AddressEncrypted) ? _encryptionService.Decrypt(contact.AddressEncrypted) : null;
        var postalCode = !string.IsNullOrEmpty(contact.PostalCodeEncrypted) ? _encryptionService.Decrypt(contact.PostalCodeEncrypted) : null;
        var locality = !string.IsNullOrEmpty(contact.LocalityEncrypted) ? _encryptionService.Decrypt(contact.LocalityEncrypted) : null;

        return new
        {
            id = contact.Id,
            name = contact.Name,
            phone = phone,
            email = email,
            address = address,
            postalCode = postalCode,
            locality = locality,
            category = contact.Category,
            condominiumId = contact.CondominiumId,
        };
    }
}


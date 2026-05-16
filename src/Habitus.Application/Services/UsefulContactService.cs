using Habitus.Application.Interfaces;
using Habitus.Application.Helpers;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace Habitus.Application.Services;

public class UsefulContactService
{
    private readonly IRepository<UsefulContact> _repository;
    private readonly IEncryptionService _encryptionService;
    private readonly bool _allowLegacyPlaintextFallback;

    public UsefulContactService(
        IRepository<UsefulContact> repository,
        IEncryptionService encryptionService,
        IConfiguration? configuration = null)
    {
        _repository = repository;
        _encryptionService = encryptionService;
        _allowLegacyPlaintextFallback = RgpdRuntimePolicy.AllowLegacyPlaintextFallback(configuration);
    }

    public async Task<IEnumerable<UsefulContact>> GetAllAsync()
    {
        var contacts = await _repository.GetAllAsync();
        return contacts.Select(MapToResponse).ToList();
    }

    public async Task<UsefulContact?> GetByIdAsync(Guid id)
    {
        var contact = await _repository.GetByIdAsync(id);
        return contact == null ? null : MapToResponse(contact);
    }

    public async Task<UsefulContact> CreateAsync(Guid condominiumId, string name, string phone, ContactCategory category)
    {
        var contact = new UsefulContact
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Name = name,
            PhoneEncrypted = string.IsNullOrWhiteSpace(phone) ? null : _encryptionService.Encrypt(phone),
            Phone = string.Empty,  // Clear plaintext phone
            Category = category
        };

        await _repository.AddAsync(contact);
        await _repository.SaveChangesAsync();

        return MapToResponse(contact);
    }

    public async Task<UsefulContact?> UpdateAsync(Guid id, string name, string? phone, ContactCategory category)
    {
        var contact = await _repository.GetByIdAsync(id);
        if (contact == null) return null;

        contact.Name = name;
        contact.Category = category;

        // Preserve existing encrypted phone when phone is omitted (null).
        // If phone is explicitly provided, update encrypted value and clear plaintext column.
        if (phone != null)
        {
            contact.PhoneEncrypted = string.IsNullOrWhiteSpace(phone) ? null : _encryptionService.Encrypt(phone);
            contact.Phone = string.Empty;  // Clear plaintext phone
        }

        _repository.Update(contact);
        await _repository.SaveChangesAsync();

        return MapToResponse(contact);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var contact = await _repository.GetByIdAsync(id);
        if (contact == null) return false;

        _repository.Remove(contact);
        await _repository.SaveChangesAsync();
        return true;
    }

    private UsefulContact MapToResponse(UsefulContact contact)
    {
        // Decrypt phone using encrypted-first logic (fallback to plaintext for legacy data)
        var decryptedPhone = !string.IsNullOrWhiteSpace(contact.PhoneEncrypted)
            ? _encryptionService.Decrypt(contact.PhoneEncrypted)
            : (_allowLegacyPlaintextFallback ? contact.Phone : string.Empty);

        // Return a copy with decrypted phone set in the Phone field for API response
        return new UsefulContact
        {
            Id = contact.Id,
            Name = contact.Name,
            Phone = decryptedPhone,
            PhoneEncrypted = contact.PhoneEncrypted,  // Preserve encrypted value (not returned to client)
            Category = contact.Category,
            CondominiumId = contact.CondominiumId,
            Condominium = contact.Condominium
        };
    }
}

using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Suppliers;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class SupplierService
{
    private readonly IRepository<Supplier> _repository;
    private readonly IEncryptionService _encryptionService;

    public SupplierService(IRepository<Supplier> repository, IEncryptionService encryptionService)
    {
        _repository = repository;
        _encryptionService = encryptionService;
    }

    public async Task<IEnumerable<SupplierDto>> GetAllAsync(Guid? condominiumId = null)
    {
        var suppliers = condominiumId.HasValue
            ? await _repository.FindAsync(s => s.CondominiumId == condominiumId.Value)
            : await _repository.GetAllAsync();

        return suppliers.Select(MapToDto).ToList();
    }

    public async Task<PaginatedResponse<SupplierDto>> GetPagedAsync(int page = 1, int pageSize = 10, string? search = null, Guid? condominiumId = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var suppliers = condominiumId.HasValue
            ? await _repository.FindAsync(s => s.CondominiumId == condominiumId.Value)
            : await _repository.GetAllAsync();

        var dtos = suppliers.Select(MapToDto).OrderBy(s => s.Name);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(s =>
                s.Name.ToLower().Contains(searchLower) ||
                (s.Contact ?? "").ToLower().Contains(searchLower) ||
                (s.Email ?? "").ToLower().Contains(searchLower) ||
                (s.Specialty ?? "").ToLower().Contains(searchLower)
            ).OrderBy(s => s.Name);
        }

        return PaginationHelper.Paginate(dtos, page, pageSize);
    }

    public async Task<SupplierDto?> GetByIdAsync(Guid id)
    {
        var supplier = await _repository.GetByIdAsync(id);
        return supplier == null ? null : MapToDto(supplier);
    }

    public async Task<SupplierDto> CreateAsync(CreateSupplierRequest request)
    {
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Contact = request.Contact,
            EmailEncrypted = string.IsNullOrWhiteSpace(request.Email) ? null : _encryptionService.Encrypt(request.Email),
            Email = string.Empty,  // Clear plaintext email
            PhoneEncrypted = string.IsNullOrWhiteSpace(request.Phone) ? null : _encryptionService.Encrypt(request.Phone),
            Phone = string.Empty,  // Clear plaintext phone
            AddressEncrypted = string.IsNullOrWhiteSpace(request.Address) ? null : _encryptionService.Encrypt(request.Address),
            Address = string.Empty,  // Clear plaintext address
            Specialty = request.Specialty,
            CondominiumId = Guid.Parse(request.CondominiumId),
            IsActive = true
        };

        await _repository.AddAsync(supplier);
        await _repository.SaveChangesAsync();

        return MapToDto(supplier);
    }

    public async Task<SupplierDto?> UpdateAsync(Guid id, UpdateSupplierRequest request)
    {
        var supplier = await _repository.GetByIdAsync(id);
        if (supplier == null) return null;

        supplier.Name = request.Name;
        supplier.Contact = request.Contact;
        supplier.Specialty = request.Specialty;
        supplier.IsActive = request.IsActive;

        // Encrypt Email if provided
        if (request.Email != null)
        {
            supplier.EmailEncrypted = string.IsNullOrWhiteSpace(request.Email) ? null : _encryptionService.Encrypt(request.Email);
            supplier.Email = string.Empty;  // Clear plaintext email
        }

        // Encrypt Phone if provided
        if (request.Phone != null)
        {
            supplier.PhoneEncrypted = string.IsNullOrWhiteSpace(request.Phone) ? null : _encryptionService.Encrypt(request.Phone);
            supplier.Phone = string.Empty;  // Clear plaintext phone
        }

        // Encrypt Address if provided
        if (request.Address != null)
        {
            supplier.AddressEncrypted = string.IsNullOrWhiteSpace(request.Address) ? null : _encryptionService.Encrypt(request.Address);
            supplier.Address = string.Empty;  // Clear plaintext address
        }

        _repository.Update(supplier);
        await _repository.SaveChangesAsync();

        return MapToDto(supplier);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var supplier = await _repository.GetByIdAsync(id);
        if (supplier == null) return false;

        _repository.Remove(supplier);
        await _repository.SaveChangesAsync();
        return true;
    }

    private SupplierDto MapToDto(Supplier supplier)
    {
        // Decrypt fields using encrypted-first logic (fallback to plaintext for legacy data)
        var decryptedEmail = !string.IsNullOrEmpty(supplier.EmailEncrypted)
            ? _encryptionService.Decrypt(supplier.EmailEncrypted)
            : supplier.Email;

        var decryptedPhone = !string.IsNullOrEmpty(supplier.PhoneEncrypted)
            ? _encryptionService.Decrypt(supplier.PhoneEncrypted)
            : supplier.Phone;

        var decryptedAddress = !string.IsNullOrEmpty(supplier.AddressEncrypted)
            ? _encryptionService.Decrypt(supplier.AddressEncrypted)
            : supplier.Address;

        return new SupplierDto
        {
            Id = supplier.Id.ToString(),
            Name = supplier.Name,
            Contact = supplier.Contact,
            Email = decryptedEmail,
            Phone = decryptedPhone,
            Address = decryptedAddress,
            Specialty = supplier.Specialty,
            IsActive = supplier.IsActive,
            CondominiumId = supplier.CondominiumId.ToString()
        };
    }
}

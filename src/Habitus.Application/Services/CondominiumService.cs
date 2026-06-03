using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Condominium;
using Habitus.Application.DTOs.Users;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class CondominiumService
{
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<Unit> _unitRepository;
    private readonly IRepository<PaymentSettings> _paymentSettingsRepository;
    private readonly IEncryptionService _encryptionService;

    public CondominiumService(
        IRepository<Condominium> condominiumRepository,
        IRepository<User> userRepository,
        IRepository<Unit> unitRepository,
        IRepository<PaymentSettings> paymentSettingsRepository,
        IEncryptionService encryptionService)
    {
        _condominiumRepository = condominiumRepository;
        _userRepository = userRepository;
        _unitRepository = unitRepository;
        _paymentSettingsRepository = paymentSettingsRepository;
        _encryptionService = encryptionService;
    }

    public async Task<IEnumerable<CondominiumResponse>> GetAllCondominiumsAsync()
    {
        var condominiums = await _condominiumRepository.GetAllAsync();
        var responses = new List<CondominiumResponse>();

        foreach (var condo in condominiums)
        {
            var users = await _userRepository.FindAsync(u => u.CondominiumId == condo.Id);
            var units = await _unitRepository.FindAsync(u => u.CondominiumId == condo.Id);

            var decryptedAddress = DecryptAddress(condo.AddressEncrypted);
            var decryptedTaxId = DecryptTaxId(condo.TaxIdEncrypted);
            var decryptedEmail = DecryptEmail(condo.EmailEncrypted);
            var decryptedPostalCode = DecryptIfPresent(condo.PostalCodeEncrypted);
            var decryptedLocality = DecryptIfPresent(condo.LocalityEncrypted);
            var decryptedContactPhone = DecryptIfPresent(condo.ContactPhoneEncrypted);

            responses.Add(new CondominiumResponse
            {
                Id = condo.Id,
                Name = condo.Name,
                Address = decryptedAddress,
                TaxId = decryptedTaxId,
                Email = decryptedEmail,
                PostalCode = decryptedPostalCode,
                Locality = decryptedLocality,
                ContactPhone = decryptedContactPhone,
                CreatedAt = condo.CreatedAt,
                IsActive = condo.IsActive,
                TotalUnits = units.Count(),
                TotalUsers = users.Count()
            });
        }

        return responses;
    }

    public async Task<PaginatedResponse<CondominiumResponse>> GetPagedCondominiumsAsync(int page, int pageSize, string? search = null)
    {
        var condominiums = await _condominiumRepository.GetAllAsync();
        var responses = new List<CondominiumResponse>();

        foreach (var condo in condominiums)
        {
            var users = await _userRepository.FindAsync(u => u.CondominiumId == condo.Id);
            var units = await _unitRepository.FindAsync(u => u.CondominiumId == condo.Id);

            var decryptedAddress = DecryptAddress(condo.AddressEncrypted);
            var decryptedTaxId = DecryptTaxId(condo.TaxIdEncrypted);
            var decryptedEmail = DecryptEmail(condo.EmailEncrypted);
            var decryptedPostalCode = DecryptIfPresent(condo.PostalCodeEncrypted);
            var decryptedLocality = DecryptIfPresent(condo.LocalityEncrypted);
            var decryptedContactPhone = DecryptIfPresent(condo.ContactPhoneEncrypted);

            responses.Add(new CondominiumResponse
            {
                Id = condo.Id,
                Name = condo.Name,
                Address = decryptedAddress,
                TaxId = decryptedTaxId,
                Email = decryptedEmail,
                PostalCode = decryptedPostalCode,
                Locality = decryptedLocality,
                ContactPhone = decryptedContactPhone,
                CreatedAt = condo.CreatedAt,
                IsActive = condo.IsActive,
                TotalUnits = units.Count(),
                TotalUsers = users.Count()
            });
        }

        var dtos = responses.AsEnumerable().OrderBy(c => c.Name);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(c =>
                c.Name.ToLower().Contains(searchLower) ||
                (c.Address ?? "").ToLower().Contains(searchLower) ||
                (c.TaxId ?? "").ToLower().Contains(searchLower)
            ).OrderBy(c => c.Name);
        }
        
        return PaginationHelper.Paginate(dtos, page, pageSize);
    }

    public async Task<CondominiumDetailResponse?> GetCondominiumByIdAsync(Guid id)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(id);
        if (condominium == null) return null;

        var users = await _userRepository.FindAsync(u => u.CondominiumId == id);
        var units = await _unitRepository.FindAsync(u => u.CondominiumId == id);

        var decryptedAddress = DecryptAddress(condominium.AddressEncrypted);
        var decryptedTaxId = DecryptTaxId(condominium.TaxIdEncrypted);
        var decryptedEmail = DecryptEmail(condominium.EmailEncrypted);
        var decryptedPostalCode = DecryptIfPresent(condominium.PostalCodeEncrypted);
        var decryptedLocality = DecryptIfPresent(condominium.LocalityEncrypted);
        var decryptedContactPhone = DecryptIfPresent(condominium.ContactPhoneEncrypted);

        var admins = users.Where(u => u.Role == UserRole.Admin).Select(u => new UserSummary
        {
            Id = u.Id,
            Name = u.Name,
            Email = string.IsNullOrEmpty(u.EmailEncrypted) ? u.Email : _encryptionService.Decrypt(u.EmailEncrypted),
            Role = u.Role.ToString()
        }).ToList();

        var unitSummaries = units.Select(u => new UnitSummary
        {
            Id = u.Id,
            Number = u.Number,
            Floor = u.Floor,
            Type = u.Type.ToString()
        }).ToList();

        return new CondominiumDetailResponse
        {
            Id = condominium.Id,
            Name = condominium.Name,
            Address = decryptedAddress,
            TaxId = decryptedTaxId,
            Email = decryptedEmail,
            PostalCode = decryptedPostalCode,
            Locality = decryptedLocality,
            ContactPhone = decryptedContactPhone,
            CreatedAt = condominium.CreatedAt,
            IsActive = condominium.IsActive,
            TotalUnits = unitSummaries.Count,
            TotalUsers = users.Count(),
            Admins = admins,
            Units = unitSummaries
        };
    }

    public async Task<CondominiumResponse> CreateCondominiumAsync(CreateCondominiumRequest request)
    {
        var encryptedAddress = EncryptIfPresent(request.Address)
            ?? throw new InvalidOperationException("Address is required.");
        var encryptedEmail = EncryptIfPresent(request.Email);
        var encryptedPostalCode = EncryptIfPresent(request.PostalCode);
        var encryptedLocality = EncryptIfPresent(request.Locality);
        var encryptedContactPhone = EncryptIfPresent(request.ContactPhone);

        var condominium = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Address = string.Empty,
            AddressEncrypted = encryptedAddress,
            Email = string.Empty,
            EmailEncrypted = encryptedEmail,
            PostalCodeEncrypted = encryptedPostalCode,
            LocalityEncrypted = encryptedLocality,
            ContactPhoneEncrypted = encryptedContactPhone,
            TaxIdEncrypted = string.IsNullOrEmpty(request.TaxId) ? null : _encryptionService.Encrypt(request.TaxId),
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        await _condominiumRepository.AddAsync(condominium);
        await _condominiumRepository.SaveChangesAsync();

        var decryptedTaxId = DecryptTaxId(condominium.TaxIdEncrypted);
        var decryptedAddress = DecryptAddress(condominium.AddressEncrypted);
        var decryptedEmail = DecryptEmail(condominium.EmailEncrypted);
        var decryptedPostalCode = DecryptIfPresent(condominium.PostalCodeEncrypted);
        var decryptedLocality = DecryptIfPresent(condominium.LocalityEncrypted);
        var decryptedContactPhone = DecryptIfPresent(condominium.ContactPhoneEncrypted);

        return new CondominiumResponse
        {
            Id = condominium.Id,
            Name = condominium.Name,
            Address = decryptedAddress,
            TaxId = decryptedTaxId,
            Email = decryptedEmail,
            PostalCode = decryptedPostalCode,
            Locality = decryptedLocality,
            ContactPhone = decryptedContactPhone,
            CreatedAt = condominium.CreatedAt,
            IsActive = condominium.IsActive,
            TotalUnits = 0,
            TotalUsers = 0
        };
    }

    public async Task<CondominiumResponse> UpdateCondominiumAsync(UpdateCondominiumRequest request)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(request.Id);
        if (condominium == null)
        {
            throw new InvalidOperationException($"Condominium with ID {request.Id} not found.");
        }

        condominium.Name = request.Name;
        condominium.AddressEncrypted = EncryptIfPresent(request.Address)
            ?? throw new InvalidOperationException("Address is required.");
        condominium.Address = string.Empty;
        condominium.TaxIdEncrypted = string.IsNullOrEmpty(request.TaxId) ? null : _encryptionService.Encrypt(request.TaxId);
        if (request.Email != null)
        {
            condominium.EmailEncrypted = EncryptIfPresent(request.Email);
            condominium.Email = string.Empty;
        }
        condominium.PostalCodeEncrypted = EncryptIfPresent(request.PostalCode);
        condominium.LocalityEncrypted = EncryptIfPresent(request.Locality);
        condominium.ContactPhoneEncrypted = EncryptIfPresent(request.ContactPhone);
        condominium.IsActive = request.IsActive;

        _condominiumRepository.Update(condominium);
        await _condominiumRepository.SaveChangesAsync();

        var users = await _userRepository.FindAsync(u => u.CondominiumId == condominium.Id);
        var units = await _unitRepository.FindAsync(u => u.CondominiumId == condominium.Id);

        var decryptedTaxId = DecryptTaxId(condominium.TaxIdEncrypted);
        var decryptedAddress = DecryptAddress(condominium.AddressEncrypted);
        var decryptedEmail = DecryptEmail(condominium.EmailEncrypted);
        var decryptedPostalCode = DecryptIfPresent(condominium.PostalCodeEncrypted);
        var decryptedLocality = DecryptIfPresent(condominium.LocalityEncrypted);
        var decryptedContactPhone = DecryptIfPresent(condominium.ContactPhoneEncrypted);

        return new CondominiumResponse
        {
            Id = condominium.Id,
            Name = condominium.Name,
            Address = decryptedAddress,
            TaxId = decryptedTaxId,
            Email = decryptedEmail,
            PostalCode = decryptedPostalCode,
            Locality = decryptedLocality,
            ContactPhone = decryptedContactPhone,
            CreatedAt = condominium.CreatedAt,
            IsActive = condominium.IsActive,
            TotalUnits = units.Count(),
            TotalUsers = users.Count()
        };
    }

    public async Task<CondominiumResponse> UpdateCondominiumEmailAsync(Guid condominiumId, string? email)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);
        if (condominium == null)
        {
            throw new InvalidOperationException($"Condominium with ID {condominiumId} not found.");
        }

        condominium.EmailEncrypted = EncryptIfPresent(email);
        condominium.Email = string.Empty;

        _condominiumRepository.Update(condominium);
        await _condominiumRepository.SaveChangesAsync();

        var users = await _userRepository.FindAsync(u => u.CondominiumId == condominium.Id);
        var units = await _unitRepository.FindAsync(u => u.CondominiumId == condominium.Id);

        var decryptedTaxId = DecryptTaxId(condominium.TaxIdEncrypted);
        var decryptedAddress = DecryptAddress(condominium.AddressEncrypted);
        var decryptedEmail = DecryptEmail(condominium.EmailEncrypted);
        var decryptedPostalCode = DecryptIfPresent(condominium.PostalCodeEncrypted);
        var decryptedLocality = DecryptIfPresent(condominium.LocalityEncrypted);
        var decryptedContactPhone = DecryptIfPresent(condominium.ContactPhoneEncrypted);

        return new CondominiumResponse
        {
            Id = condominium.Id,
            Name = condominium.Name,
            Address = decryptedAddress,
            TaxId = decryptedTaxId,
            Email = decryptedEmail,
            PostalCode = decryptedPostalCode,
            Locality = decryptedLocality,
            ContactPhone = decryptedContactPhone,
            CreatedAt = condominium.CreatedAt,
            IsActive = condominium.IsActive,
            TotalUnits = units.Count(),
            TotalUsers = users.Count()
        };
    }

    public async Task<CondominiumResponse> UpdateCondominiumContactPhoneAsync(Guid condominiumId, string? contactPhone)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);
        if (condominium == null)
        {
            throw new InvalidOperationException($"Condominium with ID {condominiumId} not found.");
        }

        condominium.ContactPhoneEncrypted = EncryptIfPresent(contactPhone);

        _condominiumRepository.Update(condominium);
        await _condominiumRepository.SaveChangesAsync();

        var users = await _userRepository.FindAsync(u => u.CondominiumId == condominium.Id);
        var units = await _unitRepository.FindAsync(u => u.CondominiumId == condominium.Id);

        var decryptedTaxId = DecryptTaxId(condominium.TaxIdEncrypted);
        var decryptedAddress = DecryptAddress(condominium.AddressEncrypted);
        var decryptedEmail = DecryptEmail(condominium.EmailEncrypted);
        var decryptedPostalCode = DecryptIfPresent(condominium.PostalCodeEncrypted);
        var decryptedLocality = DecryptIfPresent(condominium.LocalityEncrypted);
        var decryptedContactPhone = DecryptIfPresent(condominium.ContactPhoneEncrypted);

        return new CondominiumResponse
        {
            Id = condominium.Id,
            Name = condominium.Name,
            Address = decryptedAddress,
            TaxId = decryptedTaxId,
            Email = decryptedEmail,
            PostalCode = decryptedPostalCode,
            Locality = decryptedLocality,
            ContactPhone = decryptedContactPhone,
            CreatedAt = condominium.CreatedAt,
            IsActive = condominium.IsActive,
            TotalUnits = units.Count(),
            TotalUsers = users.Count()
        };
    }

    public async Task<bool> DeleteCondominiumAsync(Guid id)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(id);
        if (condominium == null) return false;

        // Check if there are users or units associated
        var users = await _userRepository.FindAsync(u => u.CondominiumId == id);
        var units = await _unitRepository.FindAsync(u => u.CondominiumId == id);

        if (users.Any() || units.Any())
        {
            throw new InvalidOperationException(
                "Cannot delete condominium with existing users or units. Please remove them first or deactivate the condominium.");
        }

        _condominiumRepository.Remove(condominium);
        await _condominiumRepository.SaveChangesAsync();
        return true;
    }

    public async Task<PaymentMethodsDto?> GetPaymentMethodsAsync(Guid condominiumId)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);
        if (condominium == null) return null;

        var settings = await _paymentSettingsRepository.FirstOrDefaultAsync(ps => ps.CondominiumId == condominiumId);
        if (settings == null)
        {
            return new PaymentMethodsDto
            {
                Iban = null,
                Instructions = null,
                MbWay = null,
                MbReference = null,
                BankTransferEnabled = true,
                MbWayEnabled = false,
                CardEnabled = false
            };
        }

        var decryptedIban = DecryptIfPresent(settings.BankTransferIbanEncrypted);
        var decryptedInstructions = DecryptIfPresent(settings.PaymentInstructionsEncrypted);
        var decryptedMbWay = DecryptIfPresent(settings.MBWayPhoneNumberEncrypted);
        var decryptedMbReferenceEntity = DecryptIfPresent(settings.MBReferenceEntityEncrypted);
        var decryptedMbReferenceReference = DecryptIfPresent(settings.MBReferenceReferenceEncrypted);

        return new PaymentMethodsDto
        {
            Iban = decryptedIban,
            Instructions = decryptedInstructions,
            MbWay = decryptedMbWay,
            MbReference = !string.IsNullOrWhiteSpace(decryptedMbReferenceEntity) && !string.IsNullOrWhiteSpace(decryptedMbReferenceReference)
                ? $"{decryptedMbReferenceEntity} | {decryptedMbReferenceReference}"
                : null,
            BankTransferEnabled = settings.BankTransferEnabled,
            MbWayEnabled = settings.MBWayEnabled,
            CardEnabled = settings.CardEnabled
        };
    }

    public async Task<PaymentMethodsDto> UpdatePaymentMethodsAsync(Guid condominiumId, UpdatePaymentMethodsRequest request)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);
        if (condominium == null)
            throw new InvalidOperationException($"Condominium with ID {condominiumId} not found.");

        var settings = await _paymentSettingsRepository.FirstOrDefaultAsync(ps => ps.CondominiumId == condominiumId);
        if (settings == null)
        {
            settings = new PaymentSettings
            {
                Id = Guid.NewGuid(),
                CondominiumId = condominiumId,
                CreatedAt = DateTime.UtcNow
            };
            await _paymentSettingsRepository.AddAsync(settings);
        }

        SplitMbReference(request.MbReference, out var mbReferenceEntity, out var mbReferenceReference);

        settings.BankTransferEnabled = request.BankTransferEnabled;
        settings.BankTransferIbanEncrypted = EncryptIfPresent(request.Iban);
        settings.PaymentInstructionsEncrypted = EncryptIfPresent(request.Instructions);
        settings.MBWayEnabled = request.MbWayEnabled;
        settings.MBWayPhoneNumberEncrypted = EncryptIfPresent(request.MbWay);
        settings.MBReferenceEnabled = !string.IsNullOrWhiteSpace(mbReferenceEntity) && !string.IsNullOrWhiteSpace(mbReferenceReference);
        settings.MBReferenceEntityEncrypted = EncryptIfPresent(mbReferenceEntity);
        settings.MBReferenceReferenceEncrypted = EncryptIfPresent(mbReferenceReference);
        settings.CardEnabled = request.CardEnabled;
        settings.UpdatedAt = DateTime.UtcNow;

        _paymentSettingsRepository.Update(settings);
        await _paymentSettingsRepository.SaveChangesAsync();

        var decryptedIban = DecryptIfPresent(settings.BankTransferIbanEncrypted);
        var decryptedInstructions = DecryptIfPresent(settings.PaymentInstructionsEncrypted);
        var decryptedMbWay = DecryptIfPresent(settings.MBWayPhoneNumberEncrypted);
        var decryptedMbReferenceEntity = DecryptIfPresent(settings.MBReferenceEntityEncrypted);
        var decryptedMbReferenceReference = DecryptIfPresent(settings.MBReferenceReferenceEncrypted);

        return new PaymentMethodsDto
        {
            Iban = decryptedIban,
            Instructions = decryptedInstructions,
            MbWay = decryptedMbWay,
            MbReference = !string.IsNullOrWhiteSpace(decryptedMbReferenceEntity) && !string.IsNullOrWhiteSpace(decryptedMbReferenceReference)
                ? $"{decryptedMbReferenceEntity} | {decryptedMbReferenceReference}"
                : null,
            BankTransferEnabled = settings.BankTransferEnabled,
            MbWayEnabled = settings.MBWayEnabled,
            CardEnabled = settings.CardEnabled
        };
    }

    // ── Public registration helpers (no auth required) ────────────────────────

    /// <summary>Returns the minimal list of active condominiums for the public registration page.</summary>
    public async Task<IEnumerable<CondominiumPublicDto>> GetPublicListAsync()
    {
        var condominiums = await _condominiumRepository.FindAsync(c => c.IsActive);
        return condominiums
            .OrderBy(c => c.Name)
            .Select(c => new CondominiumPublicDto
            {
                Id = c.Id,
                Name = c.Name,
                Address = DecryptAddress(c.AddressEncrypted)
            });
    }

    /// <summary>Returns the units of a condominium for the public registration page.</summary>
    public async Task<IEnumerable<UnitPublicDto>?> GetUnitsForRegistrationAsync(Guid condominiumId)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);
        if (condominium == null) return null;

        var units = await _unitRepository.FindAsync(u => u.CondominiumId == condominiumId);
        return units
            .OrderBy(u => u.Floor).ThenBy(u => u.Number)
            .Select(u => new UnitPublicDto
            {
                Id = u.Id,
                Number = u.Number,
                Floor = u.Floor,
                ApartmentNumber = u.ApartmentNumber
            });
    }

    private string? DecryptTaxId(string? encryptedTaxId)
    {
        return string.IsNullOrEmpty(encryptedTaxId)
            ? null
            : _encryptionService.Decrypt(encryptedTaxId);
    }

    private string DecryptAddress(string? encryptedAddress)
    {
        return string.IsNullOrEmpty(encryptedAddress)
            ? string.Empty
            : _encryptionService.Decrypt(encryptedAddress);
    }

    private string? DecryptEmail(string? encryptedEmail)
    {
         return string.IsNullOrEmpty(encryptedEmail)
            ? null
            : _encryptionService.Decrypt(encryptedEmail);
    }

    private string? EncryptIfPresent(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return _encryptionService.Encrypt(value.Trim());
    }

    private string? DecryptIfPresent(string? encryptedValue)
    {
        if (!string.IsNullOrWhiteSpace(encryptedValue))
        {
            return _encryptionService.Decrypt(encryptedValue);
        }

        return null;
    }

    private static void SplitMbReference(string? value, out string? entity, out string? reference)
    {
        entity = null;
        reference = null;

        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        var parts = value.Split('|', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2)
        {
            entity = parts[0];
            reference = parts[1];
            return;
        }

        var digitsOnly = new string(value.Where(char.IsDigit).ToArray());
        if (digitsOnly.Length >= 14)
        {
            entity = digitsOnly[..5];
            reference = digitsOnly.Substring(5, 9);
        }
    }
}

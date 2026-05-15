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

            // Decrypt TaxId if encrypted, otherwise use old field
            var decryptedTaxId = string.IsNullOrEmpty(condo.TaxIdEncrypted)
                ? condo.TaxId
                : _encryptionService.Decrypt(condo.TaxIdEncrypted);

            responses.Add(new CondominiumResponse
            {
                Id = condo.Id,
                Name = condo.Name,
                Address = condo.Address,
                TaxId = decryptedTaxId,
                Email = condo.Email,
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

            // Decrypt TaxId if encrypted, otherwise use old field
            var decryptedTaxId = string.IsNullOrEmpty(condo.TaxIdEncrypted)
                ? condo.TaxId
                : _encryptionService.Decrypt(condo.TaxIdEncrypted);

            responses.Add(new CondominiumResponse
            {
                Id = condo.Id,
                Name = condo.Name,
                Address = condo.Address,
                TaxId = decryptedTaxId,
                Email = condo.Email,
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

        // Decrypt TaxId if encrypted, otherwise use old field
        var decryptedTaxId = string.IsNullOrEmpty(condominium.TaxIdEncrypted)
            ? condominium.TaxId
            : _encryptionService.Decrypt(condominium.TaxIdEncrypted);

        var admins = users.Where(u => u.Role == UserRole.Admin).Select(u => new UserSummary
        {
            Id = u.Id,
            Name = u.Name,
            Email = u.Email,
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
            Address = condominium.Address,
            TaxId = decryptedTaxId,
            Email = condominium.Email,
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
        var condominium = new Condominium
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Address = request.Address,
            TaxId = null,
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
            TaxIdEncrypted = string.IsNullOrEmpty(request.TaxId) ? null : _encryptionService.Encrypt(request.TaxId),
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        await _condominiumRepository.AddAsync(condominium);
        await _condominiumRepository.SaveChangesAsync();

        // Return decrypted TaxId in the response
        var decryptedTaxId = string.IsNullOrEmpty(condominium.TaxIdEncrypted) 
            ? condominium.TaxId 
            : _encryptionService.Decrypt(condominium.TaxIdEncrypted);

        return new CondominiumResponse
        {
            Id = condominium.Id,
            Name = condominium.Name,
            Address = condominium.Address,
            TaxId = decryptedTaxId,
            Email = condominium.Email,
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
        condominium.Address = request.Address;
        // Preserve existing encrypted TaxId when request omits TaxId.
        // If TaxId is explicitly provided, update encrypted value and clear plaintext column.
        if (request.TaxId != null)
        {
            condominium.TaxId = null;
            condominium.TaxIdEncrypted = string.IsNullOrWhiteSpace(request.TaxId)
                ? null
                : _encryptionService.Encrypt(request.TaxId);
        }
        if (request.Email != null)
        {
            condominium.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        }
        condominium.IsActive = request.IsActive;

        _condominiumRepository.Update(condominium);
        await _condominiumRepository.SaveChangesAsync();

        var users = await _userRepository.FindAsync(u => u.CondominiumId == condominium.Id);
        var units = await _unitRepository.FindAsync(u => u.CondominiumId == condominium.Id);

        // Return decrypted TaxId in the response
        var decryptedTaxId = string.IsNullOrEmpty(condominium.TaxIdEncrypted)
            ? condominium.TaxId
            : _encryptionService.Decrypt(condominium.TaxIdEncrypted);

        return new CondominiumResponse
        {
            Id = condominium.Id,
            Name = condominium.Name,
            Address = condominium.Address,
            TaxId = decryptedTaxId,
            Email = condominium.Email,
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

        condominium.Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();

        _condominiumRepository.Update(condominium);
        await _condominiumRepository.SaveChangesAsync();

        var users = await _userRepository.FindAsync(u => u.CondominiumId == condominium.Id);
        var units = await _unitRepository.FindAsync(u => u.CondominiumId == condominium.Id);

        var decryptedTaxId = string.IsNullOrEmpty(condominium.TaxIdEncrypted)
            ? condominium.TaxId
            : _encryptionService.Decrypt(condominium.TaxIdEncrypted);

        return new CondominiumResponse
        {
            Id = condominium.Id,
            Name = condominium.Name,
            Address = condominium.Address,
            TaxId = decryptedTaxId,
            Email = condominium.Email,
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

        // Try to get payment settings first (new structure)
        var paymentSettings = await _paymentSettingsRepository.FindAsync(ps => ps.CondominiumId == condominiumId);
        var settings = paymentSettings.FirstOrDefault();

        if (settings != null)
        {
            // Use new PaymentSettings structure
            var decryptedIban = string.IsNullOrEmpty(settings.BankTransferIbanEncrypted)
                ? settings.BankTransferIban
                : _encryptionService.Decrypt(settings.BankTransferIbanEncrypted);

            return new PaymentMethodsDto
            {
                Iban = decryptedIban,
                Instructions = null, // Not in new structure, could be added if needed
                MbWay = settings.MBWayPhoneNumber,
                MbReference = settings.MBReferenceEntity != null && settings.MBReferenceReference != null
                    ? $"{settings.MBReferenceEntity} | {settings.MBReferenceReference}"
                    : null,
                BankTransferEnabled = settings.BankTransferEnabled,
                MbWayEnabled = settings.MBWayEnabled,
                CardEnabled = settings.CardEnabled
            };
        }

        // Fallback to old Condominium fields (for backward compatibility)
        var decryptedCondoIban = string.IsNullOrEmpty(condominium.PaymentIbanEncrypted)
            ? condominium.PaymentIban
            : _encryptionService.Decrypt(condominium.PaymentIbanEncrypted);

        return new PaymentMethodsDto
        {
            Iban = decryptedCondoIban,
            Instructions = condominium.PaymentInstructions,
            MbWay = condominium.PaymentMbWay,
            MbReference = condominium.PaymentMbReference,
            BankTransferEnabled = condominium.PaymentBankTransferEnabled,
            MbWayEnabled = condominium.PaymentMbWayEnabled,
            CardEnabled = condominium.PaymentCardEnabled
        };
    }

    public async Task<PaymentMethodsDto> UpdatePaymentMethodsAsync(Guid condominiumId, UpdatePaymentMethodsRequest request)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);
        if (condominium == null)
            throw new InvalidOperationException($"Condominium with ID {condominiumId} not found.");

        // Keep plaintext column empty for newly updated records.
        condominium.PaymentIban = null;
        condominium.PaymentIbanEncrypted = string.IsNullOrEmpty(request.Iban) ? null : _encryptionService.Encrypt(request.Iban);
        condominium.PaymentInstructions = request.Instructions;
        condominium.PaymentMbWay = request.MbWay;
        condominium.PaymentMbReference = request.MbReference;
        condominium.PaymentBankTransferEnabled = request.BankTransferEnabled;
        condominium.PaymentMbWayEnabled = request.MbWayEnabled;
        condominium.PaymentCardEnabled = request.CardEnabled;

        _condominiumRepository.Update(condominium);
        await _condominiumRepository.SaveChangesAsync();

        // Return decrypted IBAN in the response
        var decryptedIban = string.IsNullOrEmpty(condominium.PaymentIbanEncrypted)
            ? condominium.PaymentIban
            : _encryptionService.Decrypt(condominium.PaymentIbanEncrypted);

        return new PaymentMethodsDto
        {
            Iban = decryptedIban,
            Instructions = condominium.PaymentInstructions,
            MbWay = condominium.PaymentMbWay,
            MbReference = condominium.PaymentMbReference,
            BankTransferEnabled = condominium.PaymentBankTransferEnabled,
            MbWayEnabled = condominium.PaymentMbWayEnabled,
            CardEnabled = condominium.PaymentCardEnabled
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
                Address = c.Address
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
}

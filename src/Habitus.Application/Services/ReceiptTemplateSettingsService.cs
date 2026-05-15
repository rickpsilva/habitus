using Habitus.Application.DTOs.Receipts;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using System;
using System.Threading.Tasks;

namespace Habitus.Application.Services;

public class ReceiptTemplateSettingsService
{
    private readonly IRepository<ReceiptTemplateSettings> _repository;
    private readonly IEncryptionService _encryptionService;

    public ReceiptTemplateSettingsService(IRepository<ReceiptTemplateSettings> repository, IEncryptionService encryptionService)
    {
        _repository = repository;
        _encryptionService = encryptionService;
    }

    public async Task<ReceiptTemplateSettingsDto> GetByCondominiumIdAsync(Guid condominiumId)
    {
        var settings = (await _repository.FindAsync(rts => rts.CondominiumId == condominiumId)).FirstOrDefault();
        if (settings == null)
            return null;
        return MapToDto(settings);
    }

    public async Task<ReceiptTemplateSettingsDto> UpsertAsync(Guid condominiumId, UpdateReceiptTemplateSettingsRequest request)
    {
        var settings = (await _repository.FindAsync(rts => rts.CondominiumId == condominiumId)).FirstOrDefault();
        bool isNew = false;
        if (settings == null)
        {
            isNew = true;
            settings = new ReceiptTemplateSettings
            {
                Id = Guid.NewGuid(),
                CondominiumId = condominiumId,
                CreatedAt = DateTime.UtcNow
            };
        }
        // Encrypt and assign fields
        settings.CompanyName = request.CompanyName;
        settings.AddressEncrypted = EncryptOrNull(request.Address);
        settings.PostalCodeEncrypted = EncryptOrNull(request.PostalCode);
        settings.LocalityEncrypted = EncryptOrNull(request.Locality);
        settings.TaxIdEncrypted = EncryptOrNull(request.TaxId);
        settings.EmailEncrypted = EncryptOrNull(request.Email);
        settings.PhoneEncrypted = EncryptOrNull(request.Phone);
        settings.Template = request.Template;
        settings.TemplateMonthlyFee = request.TemplateMonthlyFee;
        settings.TemplateMonthlyFeeQuarterly = request.TemplateMonthlyFeeQuarterly;
        settings.TemplateMonthlyFeeAnnual = request.TemplateMonthlyFeeAnnual;
        settings.TemplateExtraordinaryFee = request.TemplateExtraordinaryFee;
        settings.TemplateReservation = request.TemplateReservation;
        settings.TemplateOther = request.TemplateOther;
        settings.UpdatedAt = DateTime.UtcNow;
        if (isNew)
            await _repository.AddAsync(settings);
        else
            _repository.Update(settings);
        await _repository.SaveChangesAsync();
        return MapToDto(settings);
    }

    private string? EncryptOrNull(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return _encryptionService.Encrypt(value);
    }

    private string? DecryptOrNull(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return _encryptionService.Decrypt(value);
    }

    private ReceiptTemplateSettingsDto MapToDto(ReceiptTemplateSettings entity)
    {
        return new ReceiptTemplateSettingsDto
        {
            Id = entity.Id,
            CondominiumId = entity.CondominiumId,
            CompanyName = entity.CompanyName,
            Address = DecryptOrFallback(entity.AddressEncrypted, entity.Address),
            PostalCode = DecryptOrFallback(entity.PostalCodeEncrypted, entity.PostalCode),
            Locality = DecryptOrFallback(entity.LocalityEncrypted, entity.Locality),
            TaxId = DecryptOrFallback(entity.TaxIdEncrypted, entity.TaxId),
            Email = DecryptOrFallback(entity.EmailEncrypted, entity.Email),
            Phone = DecryptOrFallback(entity.PhoneEncrypted, entity.Phone),
            Template = entity.Template,
            TemplateMonthlyFee = entity.TemplateMonthlyFee,
            TemplateMonthlyFeeQuarterly = entity.TemplateMonthlyFeeQuarterly,
            TemplateMonthlyFeeAnnual = entity.TemplateMonthlyFeeAnnual,
            TemplateExtraordinaryFee = entity.TemplateExtraordinaryFee,
            TemplateReservation = entity.TemplateReservation,
            TemplateOther = entity.TemplateOther,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }

    private string? DecryptOrFallback(string? encrypted, string? legacy)
    {
        if (!string.IsNullOrWhiteSpace(encrypted))
            return DecryptOrNull(encrypted);
        return legacy;
    }
}

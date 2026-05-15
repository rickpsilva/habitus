using Habitus.Application.DTOs.Payments;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class PaymentSettingsService
{
    private readonly IRepository<PaymentSettings> _repository;
    private readonly IEncryptionService _encryptionService;

    public PaymentSettingsService(IRepository<PaymentSettings> repository, IEncryptionService encryptionService)
    {
        _repository = repository;
        _encryptionService = encryptionService;
    }

    public async Task<PaymentSettingsDto> GetAsync(Guid condominiumId)
    {
        var settings = await _repository.FindAsync(ps => ps.CondominiumId == condominiumId);
        var paymentSettings = settings.FirstOrDefault();

        if (paymentSettings == null)
        {
            return new PaymentSettingsDto
            {
                Id = Guid.Empty,
                CondominiumId = condominiumId,
                BankTransferEnabled = true,
                BankTransferIban = null,
                BankTransferAccountHolder = null,
                MBReferenceEnabled = false,
                MBReferenceEntity = null,
                MBReferenceReference = null,
                MBWayEnabled = false,
                MBWayPhoneNumber = null,
                MBWayMerchantId = null,
                CardEnabled = false,
                CardProvider = null,
                CardPublicKey = null,
                CardMerchantId = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
        }

        return MapToDto(paymentSettings);
    }

    public async Task<PaymentSettingsDto> UpdateAsync(Guid condominiumId, UpdatePaymentSettingsRequest request)
    {
        var settings = await _repository.FindAsync(ps => ps.CondominiumId == condominiumId);
        var paymentSettings = settings.FirstOrDefault();

        var isNew = false;
        if (paymentSettings == null)
        {
            isNew = true;
            paymentSettings = new PaymentSettings
            {
                Id = Guid.NewGuid(),
                CondominiumId = condominiumId,
                CreatedAt = DateTime.UtcNow
            };
        }

        paymentSettings.BankTransferEnabled = request.BankTransferEnabled;
        paymentSettings.BankTransferIbanEncrypted = string.IsNullOrWhiteSpace(request.BankTransferIban)
            ? null
            : _encryptionService.Encrypt(request.BankTransferIban);
        // Keep plaintext column empty for newly updated records.
        paymentSettings.BankTransferIban = null;
        paymentSettings.BankTransferAccountHolder = request.BankTransferAccountHolder;

        paymentSettings.MBReferenceEnabled = request.MBReferenceEnabled;
        paymentSettings.MBReferenceEntity = request.MBReferenceEntity;
        paymentSettings.MBReferenceReference = request.MBReferenceReference;

        paymentSettings.MBWayEnabled = request.MBWayEnabled;
        paymentSettings.MBWayPhoneNumber = request.MBWayPhoneNumber;
        paymentSettings.MBWayMerchantId = request.MBWayMerchantId;

        paymentSettings.CardEnabled = request.CardEnabled;
        paymentSettings.CardProvider = request.CardProvider;
        paymentSettings.CardPublicKey = request.CardPublicKey;

        if (!string.IsNullOrWhiteSpace(request.CardSecretKey))
        {
            paymentSettings.CardSecretKeyEncrypted = _encryptionService.Encrypt(request.CardSecretKey);
            paymentSettings.CardSecretKey = null;
        }

        paymentSettings.CardMerchantId = request.CardMerchantId;
        paymentSettings.UpdatedAt = DateTime.UtcNow;

        if (isNew)
        {
            await _repository.AddAsync(paymentSettings);
        }
        else
        {
            _repository.Update(paymentSettings);
        }

        await _repository.SaveChangesAsync();

        return MapToDto(paymentSettings);
    }

    private PaymentSettingsDto MapToDto(PaymentSettings paymentSettings)
    {
        var decryptedIban = !string.IsNullOrEmpty(paymentSettings.BankTransferIbanEncrypted)
            ? _encryptionService.Decrypt(paymentSettings.BankTransferIbanEncrypted)
            : paymentSettings.BankTransferIban;

        return new PaymentSettingsDto
        {
            Id = paymentSettings.Id,
            CondominiumId = paymentSettings.CondominiumId,
            BankTransferEnabled = paymentSettings.BankTransferEnabled,
            BankTransferIban = decryptedIban,
            BankTransferAccountHolder = paymentSettings.BankTransferAccountHolder,
            MBReferenceEnabled = paymentSettings.MBReferenceEnabled,
            MBReferenceEntity = paymentSettings.MBReferenceEntity,
            MBReferenceReference = paymentSettings.MBReferenceReference,
            MBWayEnabled = paymentSettings.MBWayEnabled,
            MBWayPhoneNumber = paymentSettings.MBWayPhoneNumber,
            MBWayMerchantId = paymentSettings.MBWayMerchantId,
            CardEnabled = paymentSettings.CardEnabled,
            CardProvider = paymentSettings.CardProvider,
            CardPublicKey = paymentSettings.CardPublicKey,
            CardMerchantId = paymentSettings.CardMerchantId,
            CreatedAt = paymentSettings.CreatedAt,
            UpdatedAt = paymentSettings.UpdatedAt
        };
    }
}

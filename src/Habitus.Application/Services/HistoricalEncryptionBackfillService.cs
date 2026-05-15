using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Habitus.Application.Services;

public sealed class HistoricalEncryptionBackfillResult
{
    public int CondominiumRecordsUpdated { get; set; }
    public int InvoiceRecordsUpdated { get; set; }
    public int ValuesEncrypted { get; set; }
    public int LegacyValuesCleared { get; set; }
}

public sealed class HistoricalLegacyPlaintextAuditResult
{
    public int CondominiumTaxIdLegacyCount { get; set; }
    public int CondominiumPaymentIbanLegacyCount { get; set; }
    public int CondominiumAddressLegacyCount { get; set; }
    public int InvoiceCustomerTaxIdLegacyCount { get; set; }
    public int InvoiceCustomerAddressLegacyCount { get; set; }

    public int TotalRemaining =>
        CondominiumTaxIdLegacyCount +
        CondominiumPaymentIbanLegacyCount +
        CondominiumAddressLegacyCount +
        InvoiceCustomerTaxIdLegacyCount +
        InvoiceCustomerAddressLegacyCount;
}

public class HistoricalEncryptionBackfillService
{
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<Invoice> _invoiceRepository;
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<HistoricalEncryptionBackfillService> _logger;

    public HistoricalEncryptionBackfillService(
        IRepository<Condominium> condominiumRepository,
        IRepository<Invoice> invoiceRepository,
        IEncryptionService encryptionService,
        ILogger<HistoricalEncryptionBackfillService> logger)
    {
        _condominiumRepository = condominiumRepository;
        _invoiceRepository = invoiceRepository;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    public async Task<HistoricalEncryptionBackfillResult> RunAsync(CancellationToken cancellationToken = default)
    {
        var result = new HistoricalEncryptionBackfillResult();

        await BackfillCondominiumsAsync(result, cancellationToken);
        await BackfillInvoicesAsync(result, cancellationToken);

        return result;
    }

    public async Task<HistoricalLegacyPlaintextAuditResult> AuditRemainingLegacyPlaintextAsync(CancellationToken cancellationToken = default)
    {
        var result = new HistoricalLegacyPlaintextAuditResult();

        var condos = await _condominiumRepository.FindAsync(c =>
            !string.IsNullOrWhiteSpace(c.TaxId) ||
            !string.IsNullOrWhiteSpace(c.PaymentIban) ||
            !string.IsNullOrWhiteSpace(c.Address));

        cancellationToken.ThrowIfCancellationRequested();

        result.CondominiumTaxIdLegacyCount = condos.Count(c => !string.IsNullOrWhiteSpace(c.TaxId));
        result.CondominiumPaymentIbanLegacyCount = condos.Count(c => !string.IsNullOrWhiteSpace(c.PaymentIban));
        result.CondominiumAddressLegacyCount = condos.Count(c => !string.IsNullOrWhiteSpace(c.Address));

        var invoices = await _invoiceRepository.FindAsync(i =>
            !string.IsNullOrWhiteSpace(i.CustomerTaxId) ||
            !string.IsNullOrWhiteSpace(i.CustomerAddress));

        cancellationToken.ThrowIfCancellationRequested();

        result.InvoiceCustomerTaxIdLegacyCount = invoices.Count(i => !string.IsNullOrWhiteSpace(i.CustomerTaxId));
        result.InvoiceCustomerAddressLegacyCount = invoices.Count(i => !string.IsNullOrWhiteSpace(i.CustomerAddress));

        return result;
    }

    private async Task BackfillCondominiumsAsync(HistoricalEncryptionBackfillResult result, CancellationToken cancellationToken)
    {
        var condos = await _condominiumRepository.FindAsync(c =>
            (c.TaxIdEncrypted == null && c.TaxId != null) ||
            (c.PaymentIbanEncrypted == null && c.PaymentIban != null) ||
            (c.AddressEncrypted == null && c.Address != null) ||
            (c.TaxIdEncrypted != null && c.TaxId != null) ||
            (c.PaymentIbanEncrypted != null && c.PaymentIban != null) ||
            (c.AddressEncrypted != null && c.Address != null));

        var hasChanges = false;

        foreach (var condo in condos)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var changed = false;

            try
            {
                if (NeedsEncrypt(condo.TaxIdEncrypted, condo.TaxId))
                {
                    condo.TaxIdEncrypted = _encryptionService.Encrypt(condo.TaxId!.Trim());
                    condo.TaxId = null;
                    result.ValuesEncrypted++;
                    result.LegacyValuesCleared++;
                    changed = true;
                }
                else if (HasEncryptedAndLegacy(condo.TaxIdEncrypted, condo.TaxId))
                {
                    condo.TaxId = null;
                    result.LegacyValuesCleared++;
                    changed = true;
                }

                if (NeedsEncrypt(condo.PaymentIbanEncrypted, condo.PaymentIban))
                {
                    condo.PaymentIbanEncrypted = _encryptionService.Encrypt(condo.PaymentIban!.Trim());
                    condo.PaymentIban = null;
                    result.ValuesEncrypted++;
                    result.LegacyValuesCleared++;
                    changed = true;
                }
                else if (HasEncryptedAndLegacy(condo.PaymentIbanEncrypted, condo.PaymentIban))
                {
                    condo.PaymentIban = null;
                    result.LegacyValuesCleared++;
                    changed = true;
                }

                if (NeedsEncrypt(condo.AddressEncrypted, condo.Address))
                {
                    condo.AddressEncrypted = _encryptionService.Encrypt(condo.Address.Trim());
                    condo.Address = string.Empty;
                    result.ValuesEncrypted++;
                    result.LegacyValuesCleared++;
                    changed = true;
                }
                else if (HasEncryptedAndLegacy(condo.AddressEncrypted, condo.Address))
                {
                    condo.Address = string.Empty;
                    result.LegacyValuesCleared++;
                    changed = true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to backfill condominium {CondominiumId}. Continuing with next record.", condo.Id);
                continue;
            }

            if (changed)
            {
                _condominiumRepository.Update(condo);
                result.CondominiumRecordsUpdated++;
                hasChanges = true;
            }
        }

        if (hasChanges)
        {
            await _condominiumRepository.SaveChangesAsync();
        }
    }

    private async Task BackfillInvoicesAsync(HistoricalEncryptionBackfillResult result, CancellationToken cancellationToken)
    {
        var invoices = await _invoiceRepository.FindAsync(i =>
            (i.CustomerTaxIdEncrypted == null && i.CustomerTaxId != null) ||
            (i.CustomerAddressEncrypted == null && i.CustomerAddress != null) ||
            (i.CustomerTaxIdEncrypted != null && i.CustomerTaxId != null) ||
            (i.CustomerAddressEncrypted != null && i.CustomerAddress != null));

        var hasChanges = false;

        foreach (var invoice in invoices)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var changed = false;

            try
            {
                if (NeedsEncrypt(invoice.CustomerTaxIdEncrypted, invoice.CustomerTaxId))
                {
                    invoice.CustomerTaxIdEncrypted = _encryptionService.Encrypt(invoice.CustomerTaxId!.Trim());
                    invoice.CustomerTaxId = null;
                    result.ValuesEncrypted++;
                    result.LegacyValuesCleared++;
                    changed = true;
                }
                else if (HasEncryptedAndLegacy(invoice.CustomerTaxIdEncrypted, invoice.CustomerTaxId))
                {
                    invoice.CustomerTaxId = null;
                    result.LegacyValuesCleared++;
                    changed = true;
                }

                if (NeedsEncrypt(invoice.CustomerAddressEncrypted, invoice.CustomerAddress))
                {
                    invoice.CustomerAddressEncrypted = _encryptionService.Encrypt(invoice.CustomerAddress!.Trim());
                    invoice.CustomerAddress = null;
                    result.ValuesEncrypted++;
                    result.LegacyValuesCleared++;
                    changed = true;
                }
                else if (HasEncryptedAndLegacy(invoice.CustomerAddressEncrypted, invoice.CustomerAddress))
                {
                    invoice.CustomerAddress = null;
                    result.LegacyValuesCleared++;
                    changed = true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to backfill invoice {InvoiceId}. Continuing with next record.", invoice.Id);
                continue;
            }

            if (changed)
            {
                _invoiceRepository.Update(invoice);
                result.InvoiceRecordsUpdated++;
                hasChanges = true;
            }
        }

        if (hasChanges)
        {
            await _invoiceRepository.SaveChangesAsync();
        }
    }

    private static bool NeedsEncrypt(string? encrypted, string? legacy) =>
        string.IsNullOrWhiteSpace(encrypted) && !string.IsNullOrWhiteSpace(legacy);

    private static bool HasEncryptedAndLegacy(string? encrypted, string? legacy) =>
        !string.IsNullOrWhiteSpace(encrypted) && !string.IsNullOrWhiteSpace(legacy);
}

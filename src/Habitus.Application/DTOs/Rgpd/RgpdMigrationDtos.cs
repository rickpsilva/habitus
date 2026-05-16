namespace Habitus.Application.DTOs.Rgpd;

public class RgpdMigrationRunDto
{
    public Guid Id { get; set; }
    public string OperationType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid? TriggeredByUserId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int CondominiumRecordsUpdated { get; set; }
    public int InvoiceRecordsUpdated { get; set; }
    public int ValuesEncrypted { get; set; }
    public int LegacyValuesCleared { get; set; }
    public int RemainingCondominiumTaxIdLegacyCount { get; set; }
    public int RemainingCondominiumPaymentIbanLegacyCount { get; set; }
    public int RemainingCondominiumAddressLegacyCount { get; set; }
    public int RemainingInvoiceCustomerTaxIdLegacyCount { get; set; }
    public int RemainingInvoiceCustomerAddressLegacyCount { get; set; }
    public int RemainingTotalLegacyCount { get; set; }
    public string? ErrorMessage { get; set; }
}

public class RgpdMigrationStatusDto
{
    public bool EnableHistoricalBackfill { get; set; }
    public bool AllowLegacyPlaintextFallback { get; set; }
    public bool IsRunning { get; set; }
    public int CurrentAuditRemainingTotalLegacyCount { get; set; }
    public int CurrentAuditCondominiumTaxIdLegacyCount { get; set; }
    public int CurrentAuditCondominiumPaymentIbanLegacyCount { get; set; }
    public int CurrentAuditCondominiumAddressLegacyCount { get; set; }
    public int CurrentAuditInvoiceCustomerTaxIdLegacyCount { get; set; }
    public int CurrentAuditInvoiceCustomerAddressLegacyCount { get; set; }
    public RgpdMigrationRunDto? LatestRun { get; set; }
}

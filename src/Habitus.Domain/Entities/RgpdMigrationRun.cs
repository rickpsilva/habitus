namespace Habitus.Domain.Entities;

public enum RgpdMigrationOperationType
{
    Backfill = 0,
    Audit = 1,
}

public enum RgpdMigrationRunStatus
{
    Running = 0,
    Completed = 1,
    Failed = 2,
}

public class RgpdMigrationRun
{
    public Guid Id { get; set; }
    public RgpdMigrationOperationType OperationType { get; set; }
    public RgpdMigrationRunStatus Status { get; set; }
    public Guid? TriggeredByUserId { get; set; }
    public User? TriggeredByUser { get; set; }
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

    public string? ErrorMessage { get; set; }
}

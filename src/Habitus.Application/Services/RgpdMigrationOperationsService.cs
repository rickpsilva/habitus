using Habitus.Application.DTOs.Rgpd;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace Habitus.Application.Services;

public class RgpdMigrationOperationsService
{
    private readonly IRepository<RgpdMigrationRun> _runRepository;
    private readonly HistoricalEncryptionBackfillService _backfillService;
    private readonly IConfiguration _configuration;
    private readonly IRgpdMigrationJobQueue _jobQueue;

    public RgpdMigrationOperationsService(
        IRepository<RgpdMigrationRun> runRepository,
        HistoricalEncryptionBackfillService backfillService,
        IConfiguration configuration,
        IRgpdMigrationJobQueue jobQueue)
    {
        _runRepository = runRepository;
        _backfillService = backfillService;
        _configuration = configuration;
        _jobQueue = jobQueue;
    }

    public async Task<RgpdMigrationStatusDto> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        var runs = await _runRepository.GetAllAsync();
        cancellationToken.ThrowIfCancellationRequested();

        var latestRun = runs.OrderByDescending(r => r.StartedAt).FirstOrDefault();
        var isRunning = runs.Any(r => r.Status == RgpdMigrationRunStatus.Running);
        var audit = await _backfillService.AuditRemainingLegacyPlaintextAsync(cancellationToken);
        var enableBackfillRaw = _configuration["Rgpd:EnableHistoricalBackfill"];
        var enableBackfill = !bool.TryParse(enableBackfillRaw, out var parsedEnableBackfill) || parsedEnableBackfill;

        return new RgpdMigrationStatusDto
        {
            EnableHistoricalBackfill = enableBackfill,
            AllowLegacyPlaintextFallback = RgpdRuntimePolicy.AllowLegacyPlaintextFallback(_configuration),
            IsRunning = isRunning,
            CurrentAuditRemainingTotalLegacyCount = audit.TotalRemaining,
            CurrentAuditCondominiumTaxIdLegacyCount = audit.CondominiumTaxIdLegacyCount,
            CurrentAuditCondominiumPaymentIbanLegacyCount = audit.CondominiumPaymentIbanLegacyCount,
            CurrentAuditCondominiumAddressLegacyCount = audit.CondominiumAddressLegacyCount,
            CurrentAuditInvoiceCustomerTaxIdLegacyCount = audit.InvoiceCustomerTaxIdLegacyCount,
            CurrentAuditInvoiceCustomerAddressLegacyCount = audit.InvoiceCustomerAddressLegacyCount,
            LatestRun = latestRun == null ? null : MapRun(latestRun),
        };
    }

    public Task<RgpdMigrationRunDto> RunBackfillAsync(Guid? triggeredByUserId, CancellationToken cancellationToken = default)
    {
        return QueueRunAsync(RgpdMigrationOperationType.Backfill, triggeredByUserId, cancellationToken);
    }

    public Task<RgpdMigrationRunDto> RunAuditAsync(Guid? triggeredByUserId, CancellationToken cancellationToken = default)
    {
        return QueueRunAsync(RgpdMigrationOperationType.Audit, triggeredByUserId, cancellationToken);
    }

    public async Task ProcessRunAsync(Guid runId, CancellationToken cancellationToken = default)
    {
        var run = await _runRepository.GetByIdAsync(runId);
        if (run == null || run.Status != RgpdMigrationRunStatus.Running)
        {
            return;
        }

        try
        {
            if (run.OperationType == RgpdMigrationOperationType.Backfill)
            {
                var backfillResult = await _backfillService.RunAsync(cancellationToken);
                run.CondominiumRecordsUpdated = backfillResult.CondominiumRecordsUpdated;
                run.InvoiceRecordsUpdated = backfillResult.InvoiceRecordsUpdated;
                run.ValuesEncrypted = backfillResult.ValuesEncrypted;
                run.LegacyValuesCleared = backfillResult.LegacyValuesCleared;
            }

            var auditResult = await _backfillService.AuditRemainingLegacyPlaintextAsync(cancellationToken);
            run.RemainingCondominiumTaxIdLegacyCount = auditResult.CondominiumTaxIdLegacyCount;
            run.RemainingCondominiumPaymentIbanLegacyCount = auditResult.CondominiumPaymentIbanLegacyCount;
            run.RemainingCondominiumAddressLegacyCount = auditResult.CondominiumAddressLegacyCount;
            run.RemainingInvoiceCustomerTaxIdLegacyCount = auditResult.InvoiceCustomerTaxIdLegacyCount;
            run.RemainingInvoiceCustomerAddressLegacyCount = auditResult.InvoiceCustomerAddressLegacyCount;
            run.Status = RgpdMigrationRunStatus.Completed;
            run.CompletedAt = DateTime.UtcNow;
            run.ErrorMessage = null;
        }
        catch (Exception ex)
        {
            run.Status = RgpdMigrationRunStatus.Failed;
            run.CompletedAt = DateTime.UtcNow;
            run.ErrorMessage = ex.Message;
        }

        _runRepository.Update(run);
        await _runRepository.SaveChangesAsync();
    }

    private async Task<RgpdMigrationRunDto> QueueRunAsync(
        RgpdMigrationOperationType operationType,
        Guid? triggeredByUserId,
        CancellationToken cancellationToken)
    {
        var running = await _runRepository.FindAsync(r => r.Status == RgpdMigrationRunStatus.Running);
        if (running.Any())
        {
            throw new InvalidOperationException("Já existe uma migração RGPD em execução.");
        }

        var run = new RgpdMigrationRun
        {
            Id = Guid.NewGuid(),
            OperationType = operationType,
            Status = RgpdMigrationRunStatus.Running,
            TriggeredByUserId = triggeredByUserId,
            StartedAt = DateTime.UtcNow,
        };

        await _runRepository.AddAsync(run);
        await _runRepository.SaveChangesAsync();

        await _jobQueue.EnqueueAsync(run.Id, cancellationToken);

        return MapRun(run);
    }

    private static RgpdMigrationRunDto MapRun(RgpdMigrationRun run)
    {
        return new RgpdMigrationRunDto
        {
            Id = run.Id,
            OperationType = run.OperationType.ToString(),
            Status = run.Status.ToString(),
            TriggeredByUserId = run.TriggeredByUserId,
            StartedAt = run.StartedAt,
            CompletedAt = run.CompletedAt,
            CondominiumRecordsUpdated = run.CondominiumRecordsUpdated,
            InvoiceRecordsUpdated = run.InvoiceRecordsUpdated,
            ValuesEncrypted = run.ValuesEncrypted,
            LegacyValuesCleared = run.LegacyValuesCleared,
            RemainingCondominiumTaxIdLegacyCount = run.RemainingCondominiumTaxIdLegacyCount,
            RemainingCondominiumPaymentIbanLegacyCount = run.RemainingCondominiumPaymentIbanLegacyCount,
            RemainingCondominiumAddressLegacyCount = run.RemainingCondominiumAddressLegacyCount,
            RemainingInvoiceCustomerTaxIdLegacyCount = run.RemainingInvoiceCustomerTaxIdLegacyCount,
            RemainingInvoiceCustomerAddressLegacyCount = run.RemainingInvoiceCustomerAddressLegacyCount,
            RemainingTotalLegacyCount = run.RemainingCondominiumTaxIdLegacyCount +
                run.RemainingCondominiumPaymentIbanLegacyCount +
                run.RemainingCondominiumAddressLegacyCount +
                run.RemainingInvoiceCustomerTaxIdLegacyCount +
                run.RemainingInvoiceCustomerAddressLegacyCount,
            ErrorMessage = run.ErrorMessage,
        };
    }
}

using FluentAssertions;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Habitus.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace Habitus.Tests;

public class RgpdMigrationOperationsServiceTests
{
    [Fact]
    public async Task RunBackfillAsync_ShouldThrow_WhenAnotherRunIsRunning()
    {
        var runRepo = new Mock<IRepository<RgpdMigrationRun>>();
        runRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<RgpdMigrationRun, bool>>>() ))
            .ReturnsAsync(new List<RgpdMigrationRun>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Status = RgpdMigrationRunStatus.Running,
                    OperationType = RgpdMigrationOperationType.Backfill,
                    StartedAt = DateTime.UtcNow
                }
            });

        var condoRepo = new Mock<IRepository<Condominium>>();
        var invoiceRepo = new Mock<IRepository<Invoice>>();
        var encryption = new Mock<IEncryptionService>();
        var backfillLogger = Mock.Of<ILogger<HistoricalEncryptionBackfillService>>();
        var backfill = new HistoricalEncryptionBackfillService(
            condoRepo.Object,
            invoiceRepo.Object,
            encryption.Object,
            backfillLogger);

        var config = new ConfigurationBuilder().Build();
        var queue = new Mock<IRgpdMigrationJobQueue>();
        var service = new RgpdMigrationOperationsService(runRepo.Object, backfill, config, queue.Object);

        var act = () => service.RunBackfillAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*em execução*");
    }

    [Fact]
    public async Task RunAuditAsync_ShouldQueueRun_AndReturnRunningStatus()
    {
        var storedRuns = new List<RgpdMigrationRun>();
        var runRepo = new Mock<IRepository<RgpdMigrationRun>>();
        runRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<RgpdMigrationRun, bool>>>() ))
            .ReturnsAsync(new List<RgpdMigrationRun>());
        runRepo
            .Setup(r => r.AddAsync(It.IsAny<RgpdMigrationRun>()))
            .Callback<RgpdMigrationRun>(r => storedRuns.Add(r))
            .Returns(Task.CompletedTask);
        runRepo.Setup(r => r.Update(It.IsAny<RgpdMigrationRun>()));
        runRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        runRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((RgpdMigrationRun?)null);

        var condoRepo = new Mock<IRepository<Condominium>>();
        condoRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Condominium, bool>>>() ))
            .ReturnsAsync(new List<Condominium>
            {
                new() { Id = Guid.NewGuid(), Name = "Condo", TaxId = "123" }
            });

        var invoiceRepo = new Mock<IRepository<Invoice>>();
        invoiceRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>() ))
            .ReturnsAsync(new List<Invoice>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Number = 1,
                    Year = 2026,
                    Series = "HABITUS",
                    CustomerName = "Condo",
                    PlanName = "Starter",
                    SubscriptionId = Guid.NewGuid(),
                    CondominiumId = Guid.NewGuid(),
                    IssuedDate = DateTime.UtcNow,
                    DueDate = DateTime.UtcNow.AddDays(30),
                    PeriodStartDate = DateTime.UtcNow,
                    PeriodEndDate = DateTime.UtcNow,
                    SubtotalAmount = 1m,
                    VatAmount = 0.23m,
                    TotalAmount = 1.23m,
                    CustomerAddress = "Street"
                }
            });

        var encryption = new Mock<IEncryptionService>();
        var backfillLogger = Mock.Of<ILogger<HistoricalEncryptionBackfillService>>();
        var backfill = new HistoricalEncryptionBackfillService(
            condoRepo.Object,
            invoiceRepo.Object,
            encryption.Object,
            backfillLogger);

        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Rgpd:EnableHistoricalBackfill"] = "true",
            ["Rgpd:AllowLegacyPlaintextFallback"] = "true"
        }).Build();

        var queue = new Mock<IRgpdMigrationJobQueue>();
        queue.Setup(q => q.EnqueueAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).Returns(ValueTask.CompletedTask);
        var service = new RgpdMigrationOperationsService(runRepo.Object, backfill, config, queue.Object);

        var result = await service.RunAuditAsync(Guid.NewGuid());

        result.OperationType.Should().Be("Audit");
        result.Status.Should().Be("Running");
        result.RemainingTotalLegacyCount.Should().Be(0);
        storedRuns.Should().ContainSingle();
        queue.Verify(q => q.EnqueueAsync(storedRuns[0].Id, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessRunAsync_ShouldCompleteAuditRun_WithAuditCounts()
    {
        var runId = Guid.NewGuid();
        var runningRun = new RgpdMigrationRun
        {
            Id = runId,
            OperationType = RgpdMigrationOperationType.Audit,
            Status = RgpdMigrationRunStatus.Running,
            StartedAt = DateTime.UtcNow,
        };

        var runRepo = new Mock<IRepository<RgpdMigrationRun>>();
        runRepo.Setup(r => r.GetByIdAsync(runId)).ReturnsAsync(runningRun);
        runRepo.Setup(r => r.Update(It.IsAny<RgpdMigrationRun>()));
        runRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

        var condoRepo = new Mock<IRepository<Condominium>>();
        condoRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Condominium, bool>>>() ))
            .ReturnsAsync(new List<Condominium>
            {
                new() { Id = Guid.NewGuid(), Name = "Condo", Address = "Street" }
            });

        var invoiceRepo = new Mock<IRepository<Invoice>>();
        invoiceRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Invoice, bool>>>() ))
            .ReturnsAsync(new List<Invoice>());

        var encryption = new Mock<IEncryptionService>();
        var backfillLogger = Mock.Of<ILogger<HistoricalEncryptionBackfillService>>();
        var backfill = new HistoricalEncryptionBackfillService(
            condoRepo.Object,
            invoiceRepo.Object,
            encryption.Object,
            backfillLogger);

        var config = new ConfigurationBuilder().Build();
        var queue = new Mock<IRgpdMigrationJobQueue>();
        var service = new RgpdMigrationOperationsService(runRepo.Object, backfill, config, queue.Object);

        await service.ProcessRunAsync(runId);

        runningRun.Status.Should().Be(RgpdMigrationRunStatus.Completed);
        runningRun.CompletedAt.Should().NotBeNull();
        runningRun.RemainingCondominiumAddressLegacyCount.Should().Be(1);
        runningRun.RemainingInvoiceCustomerAddressLegacyCount.Should().Be(0);
    }
}

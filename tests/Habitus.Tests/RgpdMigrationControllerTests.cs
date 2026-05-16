using System.Linq.Expressions;
using System.Security.Claims;
using FluentAssertions;
using Habitus.Api.Controllers;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace Habitus.Tests;

public class RgpdMigrationControllerTests
{
    [Fact]
    public async Task RunMigration_ShouldReturnAccepted_WhenRunIsQueued()
    {
        var runRepo = new Mock<IRepository<RgpdMigrationRun>>();
        runRepo
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<RgpdMigrationRun, bool>>>() ))
            .ReturnsAsync(new List<RgpdMigrationRun>());
        runRepo.Setup(r => r.AddAsync(It.IsAny<RgpdMigrationRun>())).Returns(Task.CompletedTask);
        runRepo.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);

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
        queue.Setup(q => q.EnqueueAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).Returns(ValueTask.CompletedTask);

        var service = new RgpdMigrationOperationsService(runRepo.Object, backfill, config, queue.Object);
        var controller = new RgpdMigrationController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
                    }))
                }
            }
        };

        var result = await controller.RunMigration(CancellationToken.None);

        var accepted = result.Should().BeOfType<AcceptedResult>().Subject;
        accepted.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task RunMigration_ShouldReturnConflict_WhenAnotherRunIsRunning()
    {
        var runRepo = new Mock<IRepository<RgpdMigrationRun>>();
        runRepo
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<RgpdMigrationRun, bool>>>() ))
            .ReturnsAsync(new List<RgpdMigrationRun>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Status = RgpdMigrationRunStatus.Running,
                    OperationType = RgpdMigrationOperationType.Backfill,
                    StartedAt = DateTime.UtcNow,
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
        var controller = new RgpdMigrationController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity())
                }
            }
        };

        var result = await controller.RunMigration(CancellationToken.None);

        result.Should().BeOfType<ConflictObjectResult>();
    }
}

using FluentAssertions;
using Habitus.Infrastructure.Services;

namespace Habitus.Tests;

public class RgpdMigrationJobQueueTests
{
    [Fact]
    public async Task EnqueueAsync_ShouldMakeRunAvailableToConsumer()
    {
        var queue = new RgpdMigrationJobQueue();
        var runId = Guid.NewGuid();

        await queue.EnqueueAsync(runId);

        Guid? dequeued = null;
        await foreach (var item in queue.DequeueAllAsync())
        {
            dequeued = item;
            break;
        }

        dequeued.Should().Be(runId);
    }
}

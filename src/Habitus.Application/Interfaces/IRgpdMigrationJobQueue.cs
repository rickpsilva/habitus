namespace Habitus.Application.Interfaces;

public interface IRgpdMigrationJobQueue
{
    ValueTask EnqueueAsync(Guid runId, CancellationToken cancellationToken = default);
    IAsyncEnumerable<Guid> DequeueAllAsync(CancellationToken cancellationToken = default);
}

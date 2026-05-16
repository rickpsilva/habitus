using System.Threading.Channels;
using Habitus.Application.Interfaces;

namespace Habitus.Infrastructure.Services;

public class RgpdMigrationJobQueue : IRgpdMigrationJobQueue
{
    private readonly Channel<Guid> _channel;

    public RgpdMigrationJobQueue()
    {
        var options = new BoundedChannelOptions(100)
        {
            SingleReader = true,
            SingleWriter = false,
            FullMode = BoundedChannelFullMode.Wait,
        };

        _channel = Channel.CreateBounded<Guid>(options);
    }

    public ValueTask EnqueueAsync(Guid runId, CancellationToken cancellationToken = default)
    {
        return _channel.Writer.WriteAsync(runId, cancellationToken);
    }

    public IAsyncEnumerable<Guid> DequeueAllAsync(CancellationToken cancellationToken = default)
    {
        return _channel.Reader.ReadAllAsync(cancellationToken);
    }
}

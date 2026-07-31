using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Caching.Memory;

namespace Habitus.Infrastructure.Services;

/// <summary>
/// Default <see cref="IPlatformSettingsCache"/> backed by the singleton <see cref="IMemoryCache"/>.
/// Registered as Scoped because it depends on the scoped repositories, but the underlying cache is
/// shared across scopes. Cache misses load the single row with a no-tracking query so the cached
/// instance is always detached and safe to share.
/// </summary>
public class PlatformSettingsCache : IPlatformSettingsCache
{
    private const string KeyPrefix = "platform-settings:";
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(10);

    private static readonly string LocalizationKey = KeyPrefix + nameof(LocalizationSettings);
    private static readonly string BillingKey = KeyPrefix + nameof(PlatformBillingSettings);
    private static readonly string SystemEmailKey = KeyPrefix + nameof(SystemEmailSettings);
    private static readonly string UploadKey = KeyPrefix + nameof(PlatformUploadSettings);

    private readonly IMemoryCache _cache;
    private readonly IRepository<LocalizationSettings> _localizationRepository;
    private readonly IRepository<PlatformBillingSettings> _billingRepository;
    private readonly IRepository<SystemEmailSettings> _systemEmailRepository;
    private readonly IRepository<PlatformUploadSettings> _uploadRepository;

    public PlatformSettingsCache(
        IMemoryCache cache,
        IRepository<LocalizationSettings> localizationRepository,
        IRepository<PlatformBillingSettings> billingRepository,
        IRepository<SystemEmailSettings> systemEmailRepository,
        IRepository<PlatformUploadSettings> uploadRepository)
    {
        _cache = cache;
        _localizationRepository = localizationRepository;
        _billingRepository = billingRepository;
        _systemEmailRepository = systemEmailRepository;
        _uploadRepository = uploadRepository;
    }

    /// <inheritdoc/>
    public Task<LocalizationSettings?> GetLocalizationAsync()
        => GetOrCreateAsync(LocalizationKey, _localizationRepository);

    /// <inheritdoc/>
    public Task<PlatformBillingSettings?> GetBillingAsync()
        => GetOrCreateAsync(BillingKey, _billingRepository);

    /// <inheritdoc/>
    public Task<SystemEmailSettings?> GetSystemEmailAsync()
        => GetOrCreateAsync(SystemEmailKey, _systemEmailRepository);

    /// <inheritdoc/>
    public Task<PlatformUploadSettings?> GetUploadAsync()
        => GetOrCreateAsync(UploadKey, _uploadRepository);

    /// <inheritdoc/>
    public void InvalidateLocalization() => _cache.Remove(LocalizationKey);

    /// <inheritdoc/>
    public void InvalidateBilling() => _cache.Remove(BillingKey);

    /// <inheritdoc/>
    public void InvalidateSystemEmail() => _cache.Remove(SystemEmailKey);

    /// <inheritdoc/>
    public void InvalidateUpload() => _cache.Remove(UploadKey);

    /// <summary>
    /// Returns the cached single row for <typeparamref name="T"/>, loading it with a no-tracking
    /// query on a cache miss. The absence of a row (<c>null</c>) is cached too so a missing settings
    /// table does not trigger a DB round-trip on every request. A bounded absolute expiration acts as
    /// a safety net in addition to the explicit <c>Invalidate…</c> methods.
    /// </summary>
    private async Task<T?> GetOrCreateAsync<T>(string key, IRepository<T> repository) where T : class
    {
        return await _cache.GetOrCreateAsync(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = Ttl;
            return repository.FirstOrDefaultNoTrackingAsync(_ => true);
        });
    }
}

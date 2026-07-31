using Xunit;

// The integration tests all run against the single shared `habitus_test` database and exercise
// global, cross-cutting middleware (notably the RGPD mandatory-consent gate, whose "currently
// required" set is derived from the whole ConsentDefinitions table). Running test classes in
// parallel therefore lets one class's transient mandatory consent definition leak into another
// class's request window, producing spurious HTTP 451 responses and FK-ordering teardown races.
// Serializing the whole assembly keeps the shared global state deterministic.
[assembly: CollectionBehavior(DisableTestParallelization = true)]

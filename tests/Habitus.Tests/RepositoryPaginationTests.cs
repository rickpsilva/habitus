using FluentAssertions;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Habitus.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Habitus.Tests;

public class RepositoryPaginationTests
{
    private static HabitusDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<HabitusDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new HabitusDbContext(options);
    }

    private static FinancialRecord Record(Guid condominiumId, string description, DateTime date, FinancialCategory category = FinancialCategory.MonthlyFees)
        => new()
        {
            Id = Guid.NewGuid(),
            Type = FinancialType.Income,
            Amount = 100m,
            Description = description,
            Date = date,
            FiscalYear = date.Year,
            Category = category,
            CondominiumId = condominiumId
        };

    [Fact]
    public async Task GetPagedAsync_ReturnsOnlyRequestedPage_WithPagingMetadata()
    {
        await using var context = CreateContext();
        var condominiumId = Guid.NewGuid();
        for (var i = 0; i < 5; i++)
        {
            context.FinancialRecords.Add(Record(condominiumId, $"Record {i}", DateTime.UtcNow.AddDays(-i)));
        }
        await context.SaveChangesAsync();
        var repository = new Repository<FinancialRecord>(context);

        var result = await repository.GetPagedAsync(
            page: 2,
            pageSize: 2,
            filter: r => r.CondominiumId == condominiumId,
            orderBy: r => r.Date,
            descending: true);

        result.Items.Should().HaveCount(2);
        result.Page.Should().Be(2);
        result.PageSize.Should().Be(2);
        result.TotalItems.Should().Be(5);
        result.TotalPages.Should().Be(3);
        result.HasPreviousPage.Should().BeTrue();
        result.HasNextPage.Should().BeTrue();
    }

    [Fact]
    public async Task GetPagedAsync_EnforcesCondominiumIsolation()
    {
        await using var context = CreateContext();
        var condominiumA = Guid.NewGuid();
        var condominiumB = Guid.NewGuid();
        context.FinancialRecords.Add(Record(condominiumA, "A record", DateTime.UtcNow));
        context.FinancialRecords.Add(Record(condominiumB, "B record 1", DateTime.UtcNow));
        context.FinancialRecords.Add(Record(condominiumB, "B record 2", DateTime.UtcNow));
        await context.SaveChangesAsync();
        var repository = new Repository<FinancialRecord>(context);

        var result = await repository.GetPagedAsync(
            page: 1,
            pageSize: 10,
            filter: r => r.CondominiumId == condominiumA,
            orderBy: r => r.Date);

        result.TotalItems.Should().Be(1);
        result.Items.Should().OnlyContain(r => r.CondominiumId == condominiumA);
    }

    [Fact]
    public async Task GetPagedAsync_OrdersDescendingByKey()
    {
        await using var context = CreateContext();
        var condominiumId = Guid.NewGuid();
        var oldest = Record(condominiumId, "Oldest", new DateTime(2024, 1, 1));
        var newest = Record(condominiumId, "Newest", new DateTime(2024, 12, 31));
        context.FinancialRecords.AddRange(oldest, newest);
        await context.SaveChangesAsync();
        var repository = new Repository<FinancialRecord>(context);

        var result = await repository.GetPagedAsync(
            page: 1,
            pageSize: 10,
            filter: r => r.CondominiumId == condominiumId,
            orderBy: r => r.Date,
            descending: true);

        result.Items.First().Description.Should().Be("Newest");
        result.Items.Last().Description.Should().Be("Oldest");
    }

    [Fact]
    public async Task GetPagedAsync_AppliesFilterPredicate()
    {
        await using var context = CreateContext();
        var condominiumId = Guid.NewGuid();
        context.FinancialRecords.Add(Record(condominiumId, "Water bill", DateTime.UtcNow));
        context.FinancialRecords.Add(Record(condominiumId, "Elevator maintenance", DateTime.UtcNow));
        await context.SaveChangesAsync();
        var repository = new Repository<FinancialRecord>(context);

        var result = await repository.GetPagedAsync(
            page: 1,
            pageSize: 10,
            filter: r => r.CondominiumId == condominiumId && r.Description.ToLower().Contains("water"),
            orderBy: r => r.Date);

        result.TotalItems.Should().Be(1);
        result.Items.Should().ContainSingle(r => r.Description == "Water bill");
    }

    [Fact]
    public async Task GetPagedAsync_ClampsInvalidPagingArguments()
    {
        await using var context = CreateContext();
        var condominiumId = Guid.NewGuid();
        context.FinancialRecords.Add(Record(condominiumId, "Only record", DateTime.UtcNow));
        await context.SaveChangesAsync();
        var repository = new Repository<FinancialRecord>(context);

        var result = await repository.GetPagedAsync(
            page: 0,
            pageSize: 0,
            filter: r => r.CondominiumId == condominiumId,
            orderBy: r => r.Date);

        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
        result.TotalItems.Should().Be(1);
    }
}

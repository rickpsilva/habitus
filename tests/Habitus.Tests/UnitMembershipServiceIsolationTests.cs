using FluentAssertions;
using Habitus.Application.DTOs.Memberships;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;
using System.Linq.Expressions;

namespace Habitus.Tests;

public class UnitMembershipServiceIsolationTests
{
    private readonly Mock<IRepository<UnitMembership>> _membershipRepositoryMock;
    private readonly Mock<IRepository<Unit>> _unitRepositoryMock;
    private readonly UnitMembershipService _service;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _condominiumA = Guid.NewGuid();
    private readonly Guid _condominiumB = Guid.NewGuid();

    public UnitMembershipServiceIsolationTests()
    {
        _membershipRepositoryMock = new Mock<IRepository<UnitMembership>>();
        _unitRepositoryMock = new Mock<IRepository<Unit>>();

        _membershipRepositoryMock.Setup(r => r.SaveChangesAsync()).ReturnsAsync(1);
        _membershipRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<UnitMembership, bool>>>()))
            .ReturnsAsync(new List<UnitMembership>());

        _service = new UnitMembershipService(_membershipRepositoryMock.Object, _unitRepositoryMock.Object);
    }

    [Fact]
    public async Task CreateAsync_ForUnauthorizedCondominium_Throws()
    {
        // Acting user is only authorized for condominium A, but the request targets B.
        var request = new CreateUnitMembershipRequest
        {
            UserId = _userId,
            UnitId = Guid.NewGuid(),
            CondominiumId = _condominiumB,
            IsPrimary = true
        };

        var act = () => _service.CreateAsync(request, new[] { _condominiumA });

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
        _membershipRepositoryMock.Verify(r => r.AddAsync(It.IsAny<UnitMembership>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WhenUnitBelongsToAnotherCondominium_Throws()
    {
        var unitId = Guid.NewGuid();
        // The acting user is authorized for A, but the unit actually lives in B.
        _unitRepositoryMock.Setup(r => r.GetByIdAsync(unitId))
            .ReturnsAsync(new Unit { Id = unitId, CondominiumId = _condominiumB, Number = "1A" });

        var request = new CreateUnitMembershipRequest
        {
            UserId = _userId,
            UnitId = unitId,
            CondominiumId = _condominiumA,
            IsPrimary = true
        };

        var act = () => _service.CreateAsync(request, new[] { _condominiumA });

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
        _membershipRepositoryMock.Verify(r => r.AddAsync(It.IsAny<UnitMembership>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_FirstMembership_IsPersistedAsPrimary()
    {
        var unitId = Guid.NewGuid();
        _unitRepositoryMock.Setup(r => r.GetByIdAsync(unitId))
            .ReturnsAsync(new Unit { Id = unitId, CondominiumId = _condominiumA, Number = "1A" });

        UnitMembership? added = null;
        _membershipRepositoryMock.Setup(r => r.AddAsync(It.IsAny<UnitMembership>()))
            .Callback<UnitMembership>(m => added = m)
            .Returns(Task.CompletedTask);

        var request = new CreateUnitMembershipRequest
        {
            UserId = _userId,
            UnitId = unitId,
            CondominiumId = _condominiumA,
            IsPrimary = false
        };

        var result = await _service.CreateAsync(request, new[] { _condominiumA });

        result.CondominiumId.Should().Be(_condominiumA);
        result.IsPrimary.Should().BeTrue(); // first membership is always primary
        added.Should().NotBeNull();
        added!.CondominiumId.Should().Be(_condominiumA);
    }
}

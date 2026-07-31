using Habitus.Application.DTOs.Memberships;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

/// <summary>
/// Manages multi-fraction memberships (<see cref="UnitMembership"/>). Enforces the
/// multi-condominium isolation invariant: a membership's unit must belong to the target
/// condominium and the acting caller must be authorized for that condominium. Also keeps
/// exactly one primary membership per <c>{UserId, CondominiumId}</c>.
/// </summary>
public class UnitMembershipService
{
    private readonly IRepository<UnitMembership> _membershipRepository;
    private readonly IRepository<Unit> _unitRepository;

    public UnitMembershipService(
        IRepository<UnitMembership> membershipRepository,
        IRepository<Unit> unitRepository)
    {
        _membershipRepository = membershipRepository;
        _unitRepository = unitRepository;
    }

    /// <summary>Lists a user's memberships, optionally scoped to a single condominium.</summary>
    public async Task<IEnumerable<UnitMembershipDto>> GetForUserAsync(Guid userId, Guid? condominiumId = null)
    {
        var memberships = await _membershipRepository.FindAsync(m =>
            m.UserId == userId &&
            (condominiumId == null || m.CondominiumId == condominiumId));

        return memberships
            .OrderByDescending(m => m.IsPrimary)
            .ThenBy(m => m.CreatedAt)
            .Select(MapToDto)
            .ToList();
    }

    /// <summary>
    /// Creates a membership after validating the isolation invariant. The first membership
    /// created for a <c>{UserId, CondominiumId}</c> is always primary; a subsequent primary
    /// request demotes the existing primary.
    /// </summary>
    /// <exception cref="UnauthorizedAccessException">
    /// Thrown when the target condominium is not one the acting user is authorized for, or when
    /// the unit does not belong to the target condominium.
    /// </exception>
    public async Task<UnitMembershipDto> CreateAsync(
        CreateUnitMembershipRequest request,
        IReadOnlyCollection<Guid> authorizedCondominiumIds)
    {
        if (!authorizedCondominiumIds.Contains(request.CondominiumId))
        {
            throw new UnauthorizedAccessException(
                "The acting user is not authorized for the target condominium.");
        }

        var unit = await _unitRepository.GetByIdAsync(request.UnitId)
            ?? throw new InvalidOperationException("Unit not found.");

        if (unit.CondominiumId != request.CondominiumId)
        {
            throw new UnauthorizedAccessException(
                "The unit does not belong to the target condominium.");
        }

        var existing = await _membershipRepository.FirstOrDefaultAsync(m =>
            m.UserId == request.UserId && m.UnitId == request.UnitId);
        if (existing != null)
        {
            throw new InvalidOperationException("Membership already exists for this user and unit.");
        }

        var siblings = (await _membershipRepository.FindAsync(m =>
            m.UserId == request.UserId && m.CondominiumId == request.CondominiumId)).ToList();

        // First membership in the condominium is always primary; otherwise honour the request.
        var makePrimary = request.IsPrimary || siblings.Count == 0;
        if (makePrimary)
        {
            foreach (var sibling in siblings.Where(s => s.IsPrimary))
            {
                sibling.IsPrimary = false;
                _membershipRepository.Update(sibling);
            }
        }

        var entity = new UnitMembership
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            UnitId = request.UnitId,
            CondominiumId = request.CondominiumId,
            IsPrimary = makePrimary,
            CreatedAt = DateTime.UtcNow
        };

        await _membershipRepository.AddAsync(entity);
        await _membershipRepository.SaveChangesAsync();
        return MapToDto(entity);
    }

    /// <summary>Promotes a membership to primary, demoting any sibling primary in the same condominium.</summary>
    /// <exception cref="UnauthorizedAccessException">Thrown when the acting user is not authorized for the membership's condominium.</exception>
    public async Task<bool> SetPrimaryAsync(Guid membershipId, IReadOnlyCollection<Guid> authorizedCondominiumIds)
    {
        var membership = await _membershipRepository.GetByIdAsync(membershipId);
        if (membership == null) return false;

        EnsureAuthorized(membership.CondominiumId, authorizedCondominiumIds);

        var siblings = await _membershipRepository.FindAsync(m =>
            m.UserId == membership.UserId && m.CondominiumId == membership.CondominiumId);

        foreach (var sibling in siblings)
        {
            var shouldBePrimary = sibling.Id == membershipId;
            if (sibling.IsPrimary != shouldBePrimary)
            {
                sibling.IsPrimary = shouldBePrimary;
                _membershipRepository.Update(sibling);
            }
        }

        await _membershipRepository.SaveChangesAsync();
        return true;
    }

    /// <summary>Deletes a membership.</summary>
    /// <exception cref="UnauthorizedAccessException">Thrown when the acting user is not authorized for the membership's condominium.</exception>
    public async Task<bool> DeleteAsync(Guid membershipId, IReadOnlyCollection<Guid> authorizedCondominiumIds)
    {
        var membership = await _membershipRepository.GetByIdAsync(membershipId);
        if (membership == null) return false;

        EnsureAuthorized(membership.CondominiumId, authorizedCondominiumIds);

        _membershipRepository.Remove(membership);
        await _membershipRepository.SaveChangesAsync();
        return true;
    }

    private static void EnsureAuthorized(Guid condominiumId, IReadOnlyCollection<Guid> authorizedCondominiumIds)
    {
        if (!authorizedCondominiumIds.Contains(condominiumId))
        {
            throw new UnauthorizedAccessException(
                "The acting user is not authorized for the target condominium.");
        }
    }

    private static UnitMembershipDto MapToDto(UnitMembership m) => new()
    {
        Id = m.Id,
        UserId = m.UserId,
        UnitId = m.UnitId,
        CondominiumId = m.CondominiumId,
        IsPrimary = m.IsPrimary,
        CreatedAt = m.CreatedAt
    };
}

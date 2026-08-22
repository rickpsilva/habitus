using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Users;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using System.Linq.Expressions;

namespace Habitus.Application.Services;

public class UserService
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<UserCondominium> _userCondominiumRepository;
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<Unit> _unitRepository;
    private readonly IEncryptionService _encryptionService;
    private readonly IRepository<Notification>? _notificationRepository;
    private readonly INotificationDispatchService? _notificationDispatchService;

    public UserService(
        IRepository<User> userRepository,
        IRepository<UserCondominium> userCondominiumRepository,
        IRepository<Condominium> condominiumRepository,
        IRepository<Unit> unitRepository,
        IEncryptionService encryptionService,
        IRepository<Notification>? notificationRepository = null,
        INotificationDispatchService? notificationDispatchService = null)
    {
        _userRepository = userRepository;
        _userCondominiumRepository = userCondominiumRepository;
        _condominiumRepository = condominiumRepository;
        _unitRepository = unitRepository;
        _encryptionService = encryptionService;
        _notificationRepository = notificationRepository;
        _notificationDispatchService = notificationDispatchService;
    }

    public async Task<IEnumerable<UserResponse>> GetAllUsersAsync()
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => true,
            "Condominium", "Unit");

        return users.Select(MapToResponse);
    }

    public async Task<PaginatedResponse<UserResponse>> GetPagedUsersAsync(int page, int pageSize, string? search = null)
    {
        // Platform Manager view: lists only other platform Managers. Condominium Admins and
        // Residents are managed inside their own condominium, so they are excluded here.
        // Filtering by role server-side (before paging) keeps the pagination totals correct.
        return await GetPaginatedUsersAsync(u => u.Role == UserRole.Manager, page, pageSize, search);
    }

    public async Task<IEnumerable<UserResponse>> GetUsersByCondominiumAsync(Guid condominiumId)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.CondominiumId == condominiumId,
            "Condominium", "Unit");

        return users.Select(MapToResponse);
    }

    public async Task<PaginatedResponse<UserResponse>> GetUsersByCondominiumPagedAsync(Guid condominiumId, int page = 1, int pageSize = 10, string? search = null)
    {
        // Condominium view: all users of the condominium EXCEPT platform Managers.
        // Filtering by role server-side (before paging) keeps the pagination totals correct.
        return await GetPaginatedUsersAsync(u => u.CondominiumId == condominiumId && u.Role != UserRole.Manager, page, pageSize, search);
    }

    public async Task<UserResponse?> GetUserByIdAsync(Guid id)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.Id == id,
            "Condominium", "Unit");

        var user = users.FirstOrDefault();
        return user != null ? MapToResponse(user) : null;
    }

    public async Task<UserResponse> CreateUserAsync(CreateUserRequest request)
    {
        // Handle both numeric and string role values
        UserRole userRole;
        if (int.TryParse(request.Role, out int roleNumber))
        {
            // Numeric role (0=Manager, 1=Admin, 2=Resident)
            userRole = (UserRole)roleNumber;
        }
        else if (!Enum.TryParse<UserRole>(request.Role, true, out userRole))
        {
            throw new ArgumentException($"Invalid role: {request.Role}");
        }

        // Validate role-specific requirements
        if ((userRole == UserRole.Admin || userRole == UserRole.Resident) && !request.CondominiumId.HasValue)
        {
            throw new InvalidOperationException("CondominiumId is required for Admin and Resident roles.");
        }

        if (userRole == UserRole.Resident && !request.UnitId.HasValue)
        {
            throw new InvalidOperationException("UnitId is required for Resident role.");
        }

        // Check if email already exists
        var requestEmailHash = EmailHashHelper.GenerateEmailHash(request.Email);
        var existing = await _userRepository.FindAsync(u => u.EmailHash == requestEmailHash);
        if (existing.Any())
        {
            throw new InvalidOperationException($"User with email {request.Email} already exists.");
        }

        // Validate condominium exists
        if (request.CondominiumId.HasValue)
        {
            var condominium = await _condominiumRepository.GetByIdAsync(request.CondominiumId.Value);
            if (condominium == null)
            {
                throw new InvalidOperationException($"Condominium with ID {request.CondominiumId} not found.");
            }
        }

        // Validate unit exists and belongs to the condominium
        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);
            if (unit == null)
            {
                throw new InvalidOperationException($"Unit with ID {request.UnitId} not found.");
            }
            if (request.CondominiumId.HasValue && unit.CondominiumId != request.CondominiumId.Value)
            {
                throw new InvalidOperationException("Unit does not belong to the specified condominium.");
            }
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            EmailEncrypted = EncryptEmail(request.Email),
            EmailHash = requestEmailHash,
            PhoneEncrypted = EncryptPhone(request.Phone),
            Role = userRole,
            CondominiumId = request.CondominiumId,
            UnitId = request.UnitId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddAsync(user);
        await _userRepository.SaveChangesAsync();

        // Create UserCondominium relationship for non-Manager users
        if (userRole != UserRole.Manager && request.CondominiumId.HasValue)
        {
            var userCondominium = new UserCondominium
            {
                UserId = user.Id,
                CondominiumId = request.CondominiumId.Value,
                GrantedAt = DateTime.UtcNow,
                CanManage = userRole == UserRole.Admin
            };
            await _userCondominiumRepository.AddAsync(userCondominium);
            await _userCondominiumRepository.SaveChangesAsync();
        }

        return MapToResponse(user);
    }

    public async Task<UserResponse> UpdateUserAsync(UpdateUserRequest request)
    {
        var user = await _userRepository.GetByIdAsync(request.Id);
        if (user == null)
        {
            throw new InvalidOperationException($"User with ID {request.Id} not found.");
        }

        // Handle both numeric and string role values
        UserRole userRole;
        if (int.TryParse(request.Role, out int roleNumber))
        {
            // Numeric role (0=Manager, 1=Admin, 2=Resident)
            userRole = (UserRole)roleNumber;
        }
        else if (!Enum.TryParse<UserRole>(request.Role, true, out userRole))
        {
            throw new ArgumentException($"Invalid role: {request.Role}");
        }

        // Update properties
        user.Name = request.Name;

        var requestEmailHash = EmailHashHelper.GenerateEmailHash(request.Email);
        if (!string.Equals(user.EmailHash, requestEmailHash, StringComparison.Ordinal))
        {
            var existing = await _userRepository.FindAsync(u => u.Id != user.Id && u.EmailHash == requestEmailHash);
            if (existing.Any())
            {
                throw new InvalidOperationException($"User with email {request.Email} already exists.");
            }
        }

        user.EmailEncrypted = EncryptEmail(request.Email);
        user.EmailHash = requestEmailHash;
        user.PhoneEncrypted = EncryptPhone(request.Phone);
        user.Role = userRole;
        user.CondominiumId = request.CondominiumId;
        user.UnitId = request.UnitId;
        user.IsActive = request.IsActive;

        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        return MapToResponse(user);
    }

    public async Task<bool> UpdateUserPasswordAsync(Guid userId, UpdateUserPasswordRequest request)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null || !user.IsActive)
        {
            return false;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return false;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;
        user.LockoutUntil = null;
        user.FailedLoginCount = 0;
        user.LastPasswordChangedAt = DateTime.UtcNow;

        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteUserAsync(Guid id)
    {
        var user = await _userRepository.GetByIdAsync(id);
        if (user == null) return false;

        _userRepository.Remove(user);
        await _userRepository.SaveChangesAsync();
        return true;
    }

    public async Task AssignUserToCondominiumAsync(AssignUserToCondominiumRequest request)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId);
        if (user == null)
        {
            throw new InvalidOperationException($"User with ID {request.UserId} not found.");
        }

        var condominium = await _condominiumRepository.GetByIdAsync(request.CondominiumId);
        if (condominium == null)
        {
            throw new InvalidOperationException($"Condominium with ID {request.CondominiumId} not found.");
        }

        // Check if relationship already exists
        var existing = await _userCondominiumRepository.FindAsync(
            uc => uc.UserId == request.UserId && uc.CondominiumId == request.CondominiumId);
        
        if (existing.Any())
        {
            throw new InvalidOperationException("User is already assigned to this condominium.");
        }

        var userCondominium = new UserCondominium
        {
            UserId = request.UserId,
            CondominiumId = request.CondominiumId,
            GrantedAt = DateTime.UtcNow,
            CanManage = request.CanManage
        };

        await _userCondominiumRepository.AddAsync(userCondominium);
        await _userCondominiumRepository.SaveChangesAsync();
    }

    public async Task<AssociateExistingAdminResponse> AssociateExistingAdminAsync(AssociateExistingAdminRequest request)
    {
        var emailHash = EmailHashHelper.GenerateEmailHash(request.Email);
        var existingUser = await _userRepository.FirstOrDefaultAsync(u => u.EmailHash == emailHash);
        if (existingUser == null)
        {
            throw new KeyNotFoundException($"User with email {request.Email} was not found.");
        }

        var condominium = await _condominiumRepository.GetByIdAsync(request.CondominiumId);
        if (condominium == null)
        {
            throw new InvalidOperationException($"Condominium with ID {request.CondominiumId} not found.");
        }

        var association = await _userCondominiumRepository.FirstOrDefaultAsync(uc =>
            uc.UserId == existingUser.Id && uc.CondominiumId == request.CondominiumId);

        var wasAlreadyAdmin = association?.CanManage == true;

        if (association == null)
        {
            association = new UserCondominium
            {
                UserId = existingUser.Id,
                CondominiumId = request.CondominiumId,
                GrantedAt = DateTime.UtcNow,
                CanManage = true,
            };
            await _userCondominiumRepository.AddAsync(association);
        }
        else if (!association.CanManage)
        {
            association.CanManage = true;
            _userCondominiumRepository.Update(association);
        }

        if (existingUser.Role != UserRole.Manager)
        {
            existingUser.Role = UserRole.Admin;
            if (!existingUser.CondominiumId.HasValue)
            {
                existingUser.CondominiumId = request.CondominiumId;
            }

            _userRepository.Update(existingUser);
            await _userRepository.SaveChangesAsync();
        }

        await _userCondominiumRepository.SaveChangesAsync();

        if (!wasAlreadyAdmin && _notificationRepository != null && _notificationDispatchService != null)
        {
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                Title = "Associacao de administrador atribuida",
                Message = $"Foi associado como administrador ao condominio {condominium.Name}.",
                Type = NotificationType.Info,
                TargetRole = string.Empty,
                TargetUserId = existingUser.Id,
                CondominiumId = request.CondominiumId,
                SentAt = DateTime.UtcNow,
                IsRead = false,
            };

            await _notificationRepository.AddAsync(notification);
            await _notificationRepository.SaveChangesAsync();
            await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: true);
        }

        return new AssociateExistingAdminResponse
        {
            Message = wasAlreadyAdmin
                ? "Utilizador ja estava associado como administrador deste condominio."
                : "Utilizador associado como administrador com sucesso.",
            WasAlreadyAdmin = wasAlreadyAdmin,
        };
    }

    public async Task<List<CondominiumActiveUsersDto>> GetActiveUsersByCondominiumLastMonthAsync()
    {
        var since = DateTime.UtcNow.AddMonths(-1);
        var allCondominiums = await _condominiumRepository.FindAsync(c => c.IsActive);
        var activeUsers = await _userRepository.FindAsync(
            u => u.Role != UserRole.Manager && u.IsActive && u.LastLoginAt >= since);
        var grouped = activeUsers
            .Where(u => u.CondominiumId.HasValue)
            .GroupBy(u => u.CondominiumId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());
        return allCondominiums
            .Select(c => new CondominiumActiveUsersDto
            {
                CondominiumId = c.Id,
                CondominiumName = c.Name,
                ActiveUsersLastMonth = grouped.GetValueOrDefault(c.Id, 0),
            })
            .OrderByDescending(x => x.ActiveUsersLastMonth)
            .ToList();
    }

    private UserResponse MapToResponse(User user)
    {
        return new UserResponse
        {
            Id = user.Id,
            Name = user.Name,
            Email = DecryptEmail(user),
            Phone = DecryptPhone(user),
            Role = (int)user.Role,
            CondominiumId = user.CondominiumId,
            CondominiumName = user.Condominium?.Name,
            UnitId = user.UnitId,
            UnitNumber = user.Unit?.Number,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt
        };
    }

    // ── Impersonation support ─────────────────────────────────────────────

    /// <summary>
    /// Returns all impersonatable users (Admins and Residents) from condominiums the Manager has access to.
    /// Used by Managers to find users they can impersonate for support operations.
    /// If the Manager has no UserCondominium entries (platform-level manager), they can access all condominiums.
    /// </summary>
    public async Task<IEnumerable<UserResponse>> GetImpersonatableUsersAsync(Guid managerId)
    {
        // Get condominiums the Manager has access to
        var managerCondominiums = await _userCondominiumRepository.FindAsync(
            uc => uc.UserId == managerId && uc.CanManage);

        var condominiumIds = managerCondominiums.Select(uc => uc.CondominiumId).ToList();

        // If Manager has no UserCondominium entries (platform-level manager), they can access all condominiums
        Expression<Func<User, bool>> filter;
        if (!condominiumIds.Any())
        {
            // Platform-level manager - no condominium filter, just role and active status
            filter = u =>
                (u.Role == UserRole.Admin || u.Role == UserRole.Resident) &&
                u.IsActive;
        }
        else
        {
            // Condominium-scoped manager
            filter = u =>
                condominiumIds.Contains(u.CondominiumId.Value) &&
                (u.Role == UserRole.Admin || u.Role == UserRole.Resident) &&
                u.IsActive;
        }

        var users = await _userRepository.FindWithIncludesAsync(
            filter,
            "Condominium", "Unit");

        return users.Select(MapToResponse);
    }

    /// <summary>
    /// Returns paginated impersonatable users (Admins and Residents) from condominiums the Manager has access to.
    /// Optionally filters by a specific condominium.
    /// If the Manager has no UserCondominium entries (platform-level manager), they can access all condominiums.
    /// </summary>
    public async Task<PaginatedResponse<UserResponse>> GetImpersonatableUsersPagedAsync(
        Guid managerId, int page, int pageSize, string? search = null, Guid? condominiumId = null)
    {
        // Get condominiums the Manager has access to
        var managerCondominiums = await _userCondominiumRepository.FindAsync(
            uc => uc.UserId == managerId && uc.CanManage);

        var condominiumIds = managerCondominiums.Select(uc => uc.CondominiumId).ToList();

        // If specific condominium requested, verify manager has access to it
        if (condominiumId.HasValue)
        {
            if (condominiumIds.Any() && !condominiumIds.Contains(condominiumId.Value))
            {
                return new PaginatedResponse<UserResponse>
                {
                    Items = new List<UserResponse>(),
                    Page = page,
                    PageSize = pageSize,
                    TotalItems = 0,
                    TotalPages = 0
                };
            }
            condominiumIds = new List<Guid> { condominiumId.Value };
        }

        // If Manager has no UserCondominium entries (platform-level manager), they can access all condominiums
        // In this case, we don't filter by condominiumIds
        Expression<Func<User, bool>> filter;
        if (!condominiumIds.Any())
        {
            // Platform-level manager - no condominium filter, just role and active status
            filter = u =>
                (u.Role == UserRole.Admin || u.Role == UserRole.Resident) &&
                u.IsActive;
        }
        else
        {
            // Condominium-scoped manager
            filter = u =>
                condominiumIds.Contains(u.CondominiumId.Value) &&
                (u.Role == UserRole.Admin || u.Role == UserRole.Resident) &&
                u.IsActive;
        }

        return await GetPaginatedUsersAsync(filter, page, pageSize, search);
    }

    // ── Pending resident approval ─────────────────────────────────────────────

    /// <summary>
    /// Returns inactive residents pending approval for the given condominium.
    /// </summary>
    public async Task<IEnumerable<PendingUserDto>> GetPendingUsersAsync(Guid condominiumId)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.CondominiumId == condominiumId && !u.IsActive && u.Role == UserRole.Resident,
            "Unit");

        return users.Select(u => new PendingUserDto
        {
            Id = u.Id,
            Name = u.Name,
            Email = DecryptEmail(u),
            Phone = DecryptPhone(u),
            UnitId = u.UnitId,
            UnitNumber = u.Unit?.Number,
            CondominiumId = u.CondominiumId,
            CreatedAt = u.CreatedAt
        });
    }

    /// <summary>
    /// Approves a pending resident. Caller must be an Admin of the condominium
    /// or an active resident of the same unit.
    /// </summary>
    public async Task<(bool success, string? error)> ApprovePendingUserAsync(
        Guid userId, Guid approverId, string approverRole, Guid? approverUnitId)
    {
        var users = await _userRepository.FindWithIncludesAsync(u => u.Id == userId, "Unit");
        var pendingUser = users.FirstOrDefault();

        if (pendingUser == null || pendingUser.IsActive)
            return (false, "Utilizador não encontrado ou já activo.");

        if (!CanActOnPendingUser(pendingUser, approverId, approverRole, approverUnitId))
            return (false, "Sem permissão para aprovar este utilizador.");

        pendingUser.IsActive = true;
        _userRepository.Update(pendingUser);
        await _userRepository.SaveChangesAsync();
        return (true, null);
    }

    /// <summary>
    /// Rejects (deletes) a pending resident. Caller must be an Admin of the condominium
    /// or an active resident of the same unit.
    /// </summary>
    public async Task<(bool success, string? error)> RejectPendingUserAsync(
        Guid userId, Guid approverId, string approverRole, Guid? approverUnitId)
    {
        var users = await _userRepository.FindWithIncludesAsync(u => u.Id == userId, "Unit");
        var pendingUser = users.FirstOrDefault();

        if (pendingUser == null || pendingUser.IsActive)
            return (false, "Utilizador não encontrado ou já activo.");

        if (!CanActOnPendingUser(pendingUser, approverId, approverRole, approverUnitId))
            return (false, "Sem permissão para recusar este utilizador.");

        _userRepository.Remove(pendingUser);
        await _userRepository.SaveChangesAsync();
        return (true, null);
    }

    private static bool CanActOnPendingUser(
        User pendingUser, Guid approverId, string approverRole, Guid? approverUnitId)
    {
        if (approverRole == "Admin")
            return pendingUser.CondominiumId.HasValue; // Admin of same condo (enforced at controller)

        if (approverRole == "Resident" && approverUnitId.HasValue)
            return pendingUser.UnitId == approverUnitId;

        return false;
    }

    private string EncryptPhone(string? phone)
    {
        return string.IsNullOrWhiteSpace(phone)
            ? string.Empty
            : _encryptionService.Encrypt(phone.Trim());
    }

    private string EncryptEmail(string? email)
    {
        var normalized = EmailHashHelper.Normalize(email ?? string.Empty);
        return string.IsNullOrEmpty(normalized)
            ? string.Empty
            : _encryptionService.Encrypt(normalized);
    }

    private async Task<PaginatedResponse<UserResponse>> GetPaginatedUsersAsync(
        Expression<Func<User, bool>> predicate,
        int page,
        int pageSize,
        string? search = null)
    {
        var users = await _userRepository.FindWithIncludesAsync(predicate, "Condominium", "Unit");

        var dtos = users.Select(MapToResponse).OrderBy(u => u.Name);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(u =>
                u.Name.ToLower().Contains(searchLower) ||
                u.Email.ToLower().Contains(searchLower) ||
                (u.UnitNumber != null && u.UnitNumber.ToLower().Contains(searchLower))
            ).OrderBy(u => u.Name);
        }

        return PaginationHelper.Paginate(dtos, page, pageSize);
    }

    private string DecryptEmail(User user)
    {
        return string.IsNullOrWhiteSpace(user.EmailEncrypted)
            ? string.Empty
            : _encryptionService.Decrypt(user.EmailEncrypted);
    }

    private string DecryptPhone(User user)
    {
        return string.IsNullOrWhiteSpace(user.PhoneEncrypted)
            ? string.Empty
            : _encryptionService.Decrypt(user.PhoneEncrypted);
    }
}

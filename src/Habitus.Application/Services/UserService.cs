using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Users;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class UserService : IUserService
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<UserCondominium> _userCondominiumRepository;
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<Unit> _unitRepository;
    private readonly IRepository<UserGdprConsent> _userGdprConsentRepository;
    private readonly IRepository<Notification> _notificationRepository;
    private readonly INotificationDispatchService _notificationDispatchService;
    private readonly IEncryptionService _encryptionService;

    public UserService(
        IRepository<User> userRepository,
        IRepository<UserCondominium> userCondominiumRepository,
        IRepository<Condominium> condominiumRepository,
        IRepository<Unit> unitRepository,
        IRepository<UserGdprConsent> userGdprConsentRepository,
        IRepository<Notification> notificationRepository,
        INotificationDispatchService notificationDispatchService,
        IEncryptionService encryptionService)
    {
        _userRepository = userRepository;
        _userCondominiumRepository = userCondominiumRepository;
        _condominiumRepository = condominiumRepository;
        _unitRepository = unitRepository;
        _userGdprConsentRepository = userGdprConsentRepository;
        _notificationRepository = notificationRepository;
        _notificationDispatchService = notificationDispatchService;
        _encryptionService = encryptionService;
    }

    public async Task<IEnumerable<UserResponse>> GetAllUsersAsync()
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.Role == UserRole.Manager,
            "Condominium", "Unit");

        return users.Select(MapToResponse);
    }

    public async Task<PaginatedResponse<UserResponse>> GetPagedUsersAsync(int page, int pageSize, string? search = null)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.Role == UserRole.Manager,
            "Condominium", "Unit");
        
        var dtos = users.Select(MapToResponse).OrderBy(u => u.Name);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(u =>
                u.Name.ToLower().Contains(searchLower) ||
                u.Email.ToLower().Contains(searchLower)
            ).OrderBy(u => u.Name);
        }
        
        return PaginationHelper.Paginate(dtos, page, pageSize);
    }

    public async Task<IEnumerable<UserResponse>> GetUsersByCondominiumAsync(Guid condominiumId)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.CondominiumId == condominiumId || u.UserCondominiums.Any(uc => uc.CondominiumId == condominiumId),
            "Condominium", "Unit", "UserCondominiums");

        return users.Select(MapToResponse);
    }

    public async Task<PaginatedResponse<UserResponse>> GetUsersByCondominiumPagedAsync(Guid condominiumId, int page = 1, int pageSize = 10, string? search = null)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.CondominiumId == condominiumId || u.UserCondominiums.Any(uc => uc.CondominiumId == condominiumId),
            "Condominium", "Unit", "UserCondominiums");
        
        var dtos = users.Select(MapToResponse).OrderBy(u => u.Name);
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            dtos = dtos.Where(u =>
                u.Name.ToLower().Contains(searchLower) ||
                u.Email.ToLower().Contains(searchLower)
            ).OrderBy(u => u.Name);
        }
        
        return PaginationHelper.Paginate(dtos, page, pageSize);
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
        var existing = await _userRepository.FindAsync(u => u.Email == request.Email);
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
            Email = request.Email,
            Phone = string.IsNullOrEmpty(request.Phone) ? string.Empty : null,  // Clear plaintext after encryption
            PhoneEncrypted = string.IsNullOrEmpty(request.Phone) ? null : _encryptionService.Encrypt(request.Phone),
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
        user.Email = request.Email;
        
        // Encrypt phone if provided, preserve encrypted value if omitted
        if (!string.IsNullOrEmpty(request.Phone))
        {
            user.Phone = null;  // Clear plaintext
            user.PhoneEncrypted = _encryptionService.Encrypt(request.Phone);
        }
        
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

    public async Task<List<CondominiumActiveUsersDto>> GetActiveUsersByCondominiumLastMonthAsync()
    {
        var since = DateTime.UtcNow.AddMonths(-1);
        var allCondominiums = await _condominiumRepository.FindAsync(c => c.IsActive);
        var activeUsers = await _userRepository.FindAsync(
            u => u.Role != UserRole.Manager && u.IsActive && u.LastLoginAt >= since);
        var grouped = activeUsers
            .GroupBy(u => u.CondominiumId)
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
        // Decrypt phone if encrypted, otherwise use old field (fallback for legacy data)
        var decryptedPhone = string.IsNullOrEmpty(user.PhoneEncrypted)
            ? user.Phone
            : _encryptionService.Decrypt(user.PhoneEncrypted);

        return new UserResponse
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Phone = decryptedPhone,
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

    // ── Pending resident approval ─────────────────────────────────────────────

    /// <summary>
    /// Returns inactive residents pending approval for the given condominium.
    /// </summary>
    public async Task<IEnumerable<PendingUserDto>> GetPendingUsersAsync(Guid condominiumId)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.CondominiumId == condominiumId && !u.IsActive && u.Role == UserRole.Resident,
            "Unit");

        return users.Select(u => 
        {
            var decryptedPhone = string.IsNullOrEmpty(u.PhoneEncrypted)
                ? u.Phone
                : _encryptionService.Decrypt(u.PhoneEncrypted);

            return new PendingUserDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Phone = decryptedPhone,
                UnitId = u.UnitId,
                UnitNumber = u.Unit?.Number,
                CondominiumId = u.CondominiumId,
                CreatedAt = u.CreatedAt
            };
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

    public async Task<bool> HasGdprConsentAsync(string userId)
    {
        if (!Guid.TryParse(userId, out var guid))
            return false;

        var consents = await _userGdprConsentRepository.FindAsync(c =>
            c.UserId == guid && c.AcceptedTerms && c.AcceptedPrivacyPolicy);
        return consents.Any();
    }

    public async Task<GdprConsentStatusResponse> SaveGdprConsentAsync(Guid userId, string ipAddress, SaveGdprConsentRequest request)
    {
        if (!request.AcceptedTerms || !request.AcceptedPrivacyPolicy)
        {
            throw new InvalidOperationException("É necessário aceitar termos e política de privacidade.");
        }

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            throw new InvalidOperationException("Utilizador não encontrado.");
        }

        var consent = new UserGdprConsent
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ConsentedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            AcceptedTerms = request.AcceptedTerms,
            AcceptedPrivacyPolicy = request.AcceptedPrivacyPolicy,
        };

        await _userGdprConsentRepository.AddAsync(consent);
        await _userGdprConsentRepository.SaveChangesAsync();

        return new GdprConsentStatusResponse
        {
            HasConsent = true,
            LastConsentedAt = consent.ConsentedAt,
        };
    }

    public async Task<GdprConsentStatusResponse> GetGdprConsentStatusAsync(Guid userId)
    {
        var consents = await _userGdprConsentRepository.FindAsync(c =>
            c.UserId == userId && c.AcceptedTerms && c.AcceptedPrivacyPolicy);

        var latest = consents.OrderByDescending(c => c.ConsentedAt).FirstOrDefault();
        return new GdprConsentStatusResponse
        {
            HasConsent = latest != null,
            LastConsentedAt = latest?.ConsentedAt,
        };
    }

    public async Task<UserDataExportResponse> GetMyDataExportAsync(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            throw new InvalidOperationException("Utilizador não encontrado.");
        }

        var consentStatus = await GetGdprConsentStatusAsync(userId);
        
        // Decrypt phone if encrypted, otherwise use old field (fallback for legacy data)
        var decryptedPhone = string.IsNullOrEmpty(user.PhoneEncrypted)
            ? user.Phone
            : _encryptionService.Decrypt(user.PhoneEncrypted);

        return new UserDataExportResponse
        {
            UserId = user.Id,
            Name = user.Name,
            Email = user.Email,
            Phone = decryptedPhone,
            Role = (int)user.Role,
            CondominiumId = user.CondominiumId,
            UnitId = user.UnitId,
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt,
            GdprErasureRequestedAt = user.GdprErasureRequestedAt,
            HasGdprConsent = consentStatus.HasConsent,
            LastConsentedAt = consentStatus.LastConsentedAt,
        };
    }

    public async Task RequestGdprErasureAsync(Guid userId, string ipAddress)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            throw new InvalidOperationException($"User with ID {userId} not found.");

        if (user.GdprErasureRequestedAt != null)
            throw new InvalidOperationException("Pedido de eliminação já foi efetuado.");

        user.GdprErasureRequestedAt = DateTime.UtcNow;
        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        var createdNotifications = new List<Notification>();

        if (user.CondominiumId.HasValue)
        {
            var adminNotification = new Notification
            {
                Id = Guid.NewGuid(),
                Title = "Pedido RGPD de eliminação de dados",
                Message = $"O utilizador {user.Name} ({user.Email}) solicitou eliminação/anonymização dos dados pessoais.",
                Type = NotificationType.Alert,
                TargetRole = "Admin",
                CondominiumId = user.CondominiumId.Value,
                SentAt = DateTime.UtcNow,
                IsRead = false,
            };

            await _notificationRepository.AddAsync(adminNotification);
            createdNotifications.Add(adminNotification);
        }

        if (createdNotifications.Count > 0)
        {
            await _notificationRepository.SaveChangesAsync();

            var dispatchable = createdNotifications
                .Where(n => n.CondominiumId != Guid.Empty)
                .ToList();

            if (dispatchable.Count > 0)
            {
                await _notificationDispatchService.DispatchAsync(dispatchable, sendExternalChannels: true);
            }
        }
    }

    public async Task ApproveGdprErasureAsync(Guid userId, Guid managerId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            throw new InvalidOperationException($"User with ID {userId} not found.");

        if (user.GdprErasureRequestedAt == null)
            throw new InvalidOperationException("Nenhum pedido de eliminação pendente.");

        // Anonymize user data (soft delete + anonymization)
        user.Name = "DELETED USER";
        user.Email = $"deleted_{Guid.NewGuid()}@deleted.local";
        user.Phone = null;
        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;
        user.DeletionReason = "GDPR_ERASURE";

        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        // TODO: Audit log, notification, and further cleanup if needed
    }

    public async Task<UserResponse> UpdateMyProfileAsync(Guid userId, UpdateMyProfileRequest request)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            throw new InvalidOperationException($"User with ID {userId} not found.");
        }

        // Only allow updating Name, Email, Phone
        user.Name = request.Name;
        user.Email = request.Email;
        user.Phone = request.Phone;

        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        return MapToResponse(user);
    }
}

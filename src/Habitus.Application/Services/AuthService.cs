using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Habitus.Application.DTOs.Auth;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using OtpNet;

namespace Habitus.Application.Services;

public enum InitialManagerBootstrapStatus
{
    MissingConfiguration,
    ManagerAlreadyExists,
    EmailAlreadyExists,
    Created,
}

public sealed class InactiveCondominiumAccessException : Exception
{
    public InactiveCondominiumAccessException()
        : base("Condominium is inactive.")
    {
    }
}

public class AuthService
{
    private const int MaxFailedLoginAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan LoginChallengeDuration = TimeSpan.FromMinutes(10);

    private readonly IRepository<User> _userRepository;
    private readonly IRepository<UserCondominium> _userCondominiumRepository;
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<Unit> _unitRepository;
    private readonly IRepository<UserAuthProvider> _userAuthProviderRepository;
    private readonly IRepository<UserRecoveryCode> _userRecoveryCodeRepository;
    private readonly IRepository<AuthChallenge> _authChallengeRepository;
    private readonly IConfiguration _configuration;
    private readonly IEmailService _emailService;
    private readonly IEncryptionService _encryptionService;

    public AuthService(
        IRepository<User> userRepository,
        IRepository<UserCondominium> userCondominiumRepository,
        IRepository<Condominium> condominiumRepository,
        IRepository<Unit> unitRepository,
        IRepository<UserAuthProvider> userAuthProviderRepository,
        IRepository<UserRecoveryCode> userRecoveryCodeRepository,
        IRepository<AuthChallenge> authChallengeRepository,
        IConfiguration configuration,
        IEmailService emailService,
        IEncryptionService encryptionService)
    {
        _userRepository = userRepository;
        _userCondominiumRepository = userCondominiumRepository;
        _condominiumRepository = condominiumRepository;
        _unitRepository = unitRepository;
        _userAuthProviderRepository = userAuthProviderRepository;
        _userRecoveryCodeRepository = userRecoveryCodeRepository;
        _authChallengeRepository = authChallengeRepository;
        _configuration = configuration;
        _emailService = emailService;
        _encryptionService = encryptionService;
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request, string? ipAddress = null, string? userAgent = null)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.Email == request.Email,
            "UserCondominiums.Condominium");

        var user = users.FirstOrDefault();
        if (user == null || !user.IsActive)
        {
            return null;
        }

        if (!await IsCondominiumActiveForUserAsync(user))
        {
            throw new InactiveCondominiumAccessException();
        }

        if (user.LockoutUntil.HasValue && user.LockoutUntil.Value > DateTime.UtcNow)
        {
            return null;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            user.FailedLoginCount += 1;
            if (user.FailedLoginCount >= MaxFailedLoginAttempts)
            {
                user.LockoutUntil = DateTime.UtcNow.Add(LockoutDuration);
                user.FailedLoginCount = 0;
            }

            _userRepository.Update(user);
            await _userRepository.SaveChangesAsync();
            return null;
        }

        user.LastLoginAt = DateTime.UtcNow;
        user.FailedLoginCount = 0;
        user.LockoutUntil = null;
        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        if (user.TwoFactorEnabled)
        {
            return await CreateTwoFactorChallengeResponseAsync(user, ipAddress, userAgent);
        }

        return await CreateAuthenticatedResponseAsync(user);
    }

    public async Task<AuthResponse?> CompleteTwoFactorLoginAsync(CompleteTwoFactorLoginRequest request, string? ipAddress = null, string? userAgent = null)
    {
        if (!Guid.TryParse(request.ChallengeId, out var challengeId))
        {
            return null;
        }

        var challenge = await _authChallengeRepository.GetByIdWithIncludesAsync(challengeId, nameof(AuthChallenge.User));
        if (challenge == null || challenge.UsedAt.HasValue || challenge.ExpiresAt <= DateTime.UtcNow)
        {
            return null;
        }

        var user = challenge.User;
        if (!user.TwoFactorEnabled)
        {
            return null;
        }

        if (!await IsCondominiumActiveForUserAsync(user))
        {
            throw new InactiveCondominiumAccessException();
        }

        var valid = request.UseRecoveryCode
            ? await ConsumeRecoveryCodeAsync(user.Id, request.Code)
            : ValidateTotpCode(user, request.Code);
        if (!valid)
        {
            return null;
        }

        challenge.UsedAt = DateTime.UtcNow;
        challenge.IpAddress = ipAddress ?? challenge.IpAddress;
        challenge.UserAgent = userAgent ?? challenge.UserAgent;
        _authChallengeRepository.Update(challenge);
        await _authChallengeRepository.SaveChangesAsync();

        return await CreateAuthenticatedResponseAsync(user);
    }

    public async Task<TwoFactorSetupResponse?> SetupTwoFactorAsync(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            return null;
        }

        var secretBytes = KeyGeneration.GenerateRandomKey(20);
        var manualEntryKey = Base32Encoding.ToString(secretBytes);

        user.TwoFactorSecretEncrypted = _encryptionService.Encrypt(manualEntryKey);
        user.TwoFactorEnabled = false;
        user.TwoFactorConfirmedAt = null;
        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        var issuer = Uri.EscapeDataString("Habitus");
        var label = Uri.EscapeDataString($"Habitus:{user.Email}");
        var otpauthUri = $"otpauth://totp/{label}?secret={manualEntryKey}&issuer={issuer}&digits=6";

        return new TwoFactorSetupResponse
        {
            IsEnabled = user.TwoFactorEnabled,
            ManualEntryKey = manualEntryKey,
            OtpauthUri = otpauthUri,
        };
    }

    public async Task<TwoFactorSetupCompleteResponse?> VerifyTwoFactorSetupAsync(Guid userId, VerifyTwoFactorSetupRequest request)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null || string.IsNullOrWhiteSpace(user.TwoFactorSecretEncrypted))
        {
            return null;
        }

        if (!ValidateTotpCode(user, request.Code))
        {
            return null;
        }

        user.TwoFactorEnabled = true;
        user.TwoFactorConfirmedAt = DateTime.UtcNow;
        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        var recoveryCodes = await ReplaceRecoveryCodesAsync(user.Id);
        return new TwoFactorSetupCompleteResponse
        {
            TwoFactorEnabled = true,
            RecoveryCodes = recoveryCodes,
        };
    }

    public async Task<bool> DisableTwoFactorAsync(Guid userId, DisableTwoFactorRequest request)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null || !user.TwoFactorEnabled)
        {
            return false;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return false;
        }

        var validCode = request.UseRecoveryCode
            ? await ConsumeRecoveryCodeAsync(user.Id, request.Code)
            : ValidateTotpCode(user, request.Code);
        if (!validCode)
        {
            return false;
        }

        user.TwoFactorEnabled = false;
        user.TwoFactorSecretEncrypted = null;
        user.TwoFactorConfirmedAt = null;
        _userRepository.Update(user);

        var recoveryCodes = await _userRecoveryCodeRepository.FindAsync(c => c.UserId == user.Id);
        foreach (var recoveryCode in recoveryCodes)
        {
            _userRecoveryCodeRepository.Remove(recoveryCode);
        }
        await _userRecoveryCodeRepository.SaveChangesAsync();

        var challenges = await _authChallengeRepository.FindAsync(c => c.UserId == user.Id && !c.UsedAt.HasValue);
        foreach (var challenge in challenges)
        {
            challenge.UsedAt = DateTime.UtcNow;
            _authChallengeRepository.Update(challenge);
        }
        await _authChallengeRepository.SaveChangesAsync();
        await _userRepository.SaveChangesAsync();

        return true;
    }

    public async Task<TwoFactorSecurityResponse?> GetTwoFactorSecurityAsync(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            return null;
        }

        var recoveryCodes = await _userRecoveryCodeRepository.FindAsync(c => c.UserId == user.Id && !c.UsedAt.HasValue);
        var linkedProviders = await _userAuthProviderRepository.FindAsync(p => p.UserId == user.Id);

        return new TwoFactorSecurityResponse
        {
            TwoFactorEnabled = user.TwoFactorEnabled,
            RecoveryCodesRemaining = recoveryCodes.Count(),
            LinkedProviders = linkedProviders
                .OrderBy(p => p.ProviderType)
                .Select(p => new LinkedAuthProviderDto
                {
                    Provider = p.ProviderType.ToString(),
                    ProviderEmail = p.ProviderEmail,
                    CreatedAt = p.CreatedAt,
                    LastUsedAt = p.LastUsedAt,
                })
                .ToList(),
        };
    }

    public async Task<RecoveryCodesResponse?> RegenerateRecoveryCodesAsync(Guid userId, RegenerateRecoveryCodesRequest request)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null || !user.TwoFactorEnabled)
        {
            return null;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return null;
        }

        var validCode = request.UseRecoveryCode
            ? await ConsumeRecoveryCodeAsync(user.Id, request.Code)
            : ValidateTotpCode(user, request.Code);
        if (!validCode)
        {
            return null;
        }

        return new RecoveryCodesResponse
        {
            RecoveryCodes = await ReplaceRecoveryCodesAsync(user.Id),
        };
    }

    public async Task<AuthResponse?> LoginWithExternalProviderAsync(ExternalAuthProvider provider, string providerUserId, string providerEmail, string? ipAddress = null, string? userAgent = null)
    {
        var existingLink = (await _userAuthProviderRepository.FindAsync(
            p => p.ProviderType == provider && p.ProviderUserId == providerUserId)).FirstOrDefault();

        User? user;
        if (existingLink != null)
        {
            user = await _userRepository.GetByIdAsync(existingLink.UserId);
            existingLink.LastUsedAt = DateTime.UtcNow;
            _userAuthProviderRepository.Update(existingLink);
            await _userAuthProviderRepository.SaveChangesAsync();
        }
        else
        {
            user = (await _userRepository.FindWithIncludesAsync(
                u => u.Email == providerEmail,
                "UserCondominiums.Condominium")).FirstOrDefault();
            if (user == null || !user.IsActive)
            {
                return null;
            }

            await LinkExternalProviderAsync(user.Id, provider, providerUserId, providerEmail);
        }

        if (user == null || !user.IsActive)
        {
            return null;
        }

        if (!await IsCondominiumActiveForUserAsync(user))
        {
            throw new InactiveCondominiumAccessException();
        }

        user.LastLoginAt = DateTime.UtcNow;
        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        if (user.TwoFactorEnabled)
        {
            return await CreateTwoFactorChallengeResponseAsync(user, ipAddress, userAgent);
        }

        return await CreateAuthenticatedResponseAsync(user);
    }

    public async Task<bool> LinkExternalProviderAsync(Guid userId, ExternalAuthProvider provider, string providerUserId, string providerEmail)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            return false;
        }

        var currentLink = (await _userAuthProviderRepository.FindAsync(
            p => p.ProviderType == provider && p.ProviderUserId == providerUserId)).FirstOrDefault();
        if (currentLink != null && currentLink.UserId != userId)
        {
            return false;
        }

        var existingForUser = (await _userAuthProviderRepository.FindAsync(
            p => p.UserId == userId && p.ProviderType == provider)).FirstOrDefault();
        if (existingForUser == null)
        {
            existingForUser = new UserAuthProvider
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ProviderType = provider,
                ProviderUserId = providerUserId,
                ProviderEmail = providerEmail,
                CreatedAt = DateTime.UtcNow,
                LastUsedAt = DateTime.UtcNow,
            };
            await _userAuthProviderRepository.AddAsync(existingForUser);
        }
        else
        {
            existingForUser.ProviderUserId = providerUserId;
            existingForUser.ProviderEmail = providerEmail;
            existingForUser.LastUsedAt = DateTime.UtcNow;
            _userAuthProviderRepository.Update(existingForUser);
        }

        await _userAuthProviderRepository.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UnlinkExternalProviderAsync(Guid userId, ExternalAuthProvider provider)
    {
        var link = (await _userAuthProviderRepository.FindAsync(p => p.UserId == userId && p.ProviderType == provider)).FirstOrDefault();
        if (link == null)
        {
            return false;
        }

        _userAuthProviderRepository.Remove(link);
        await _userAuthProviderRepository.SaveChangesAsync();
        return true;
    }

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request)
    {
        var existing = await _userRepository.FindAsync(u => u.Email == request.Email);
        if (existing.Any()) return null;

        if (!Enum.TryParse<UserRole>(request.Role, true, out var userRole))
        {
            return null;
        }

        if (userRole == UserRole.Manager)
        {
            throw new InvalidOperationException("Public registration for Manager accounts is not allowed.");
        }

        if (userRole == UserRole.Admin || userRole == UserRole.Resident)
        {
            if (!request.CondominiumId.HasValue)
            {
                throw new InvalidOperationException("CondominiumId is required for Admin and Resident roles.");
            }
        }

        if (userRole == UserRole.Resident && !request.UnitId.HasValue)
        {
            throw new InvalidOperationException("UnitId is required for Resident role.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            Role = userRole,
            CondominiumId = request.CondominiumId,
            UnitId = request.UnitId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        };

        await _userRepository.AddAsync(user);
        await _userRepository.SaveChangesAsync();

        if (userRole != UserRole.Manager && request.CondominiumId.HasValue)
        {
            var userCondominium = new UserCondominium
            {
                UserId = user.Id,
                CondominiumId = request.CondominiumId.Value,
                GrantedAt = DateTime.UtcNow,
                CanManage = userRole == UserRole.Admin,
            };
            await _userCondominiumRepository.AddAsync(userCondominium);
            await _userCondominiumRepository.SaveChangesAsync();
        }

        return await CreateAuthenticatedResponseAsync(user);
    }

    public async Task<InitialManagerBootstrapStatus> EnsureInitialManagerAsync()
    {
        var name = _configuration["InitialManager:Name"]?.Trim();
        var email = _configuration["InitialManager:Email"]?.Trim();
        var password = _configuration["InitialManager:Password"];
        var phone = _configuration["InitialManager:Phone"]?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return InitialManagerBootstrapStatus.MissingConfiguration;
        }

        var existingManagers = await _userRepository.FindAsync(u => u.Role == UserRole.Manager);
        if (existingManagers.Any())
        {
            return InitialManagerBootstrapStatus.ManagerAlreadyExists;
        }

        var existingEmail = await _userRepository.FindAsync(u => u.Email == email);
        if (existingEmail.Any())
        {
            return InitialManagerBootstrapStatus.EmailAlreadyExists;
        }

        var manager = new User
        {
            Id = Guid.NewGuid(),
            Name = name,
            Email = email,
            Phone = phone,
            Role = UserRole.Manager,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        };

        await _userRepository.AddAsync(manager);
        await _userRepository.SaveChangesAsync();

        return InitialManagerBootstrapStatus.Created;
    }

    public async Task<(RegisterResidentResponse? response, string? error)> RegisterResidentAsync(Guid condominiumId, RegisterResidentRequest request)
    {
        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);
        if (condominium == null)
            return (null, "Condomínio não encontrado.");

        if (!condominium.IsActive)
            return (null, "Este condomínio está inativo. Contacte o administrador do condomínio.");

        var existing = await _userRepository.FindAsync(u => u.Email == request.Email);
        if (existing.Any())
            return (null, "Este email já está registado.");

        var unit = await _unitRepository.GetByIdAsync(request.UnitId);
        if (unit == null || unit.CondominiumId != condominiumId)
            return (null, "Fração inválida para este condomínio.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            Role = UserRole.Resident,
            CondominiumId = condominiumId,
            UnitId = request.UnitId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsActive = false,
            CreatedAt = DateTime.UtcNow,
            LastPasswordChangedAt = DateTime.UtcNow,
        };

        await _userRepository.AddAsync(user);
        await _userRepository.SaveChangesAsync();

        var userCondominium = new UserCondominium
        {
            UserId = user.Id,
            CondominiumId = condominiumId,
            GrantedAt = DateTime.UtcNow,
            CanManage = false,
        };
        await _userCondominiumRepository.AddAsync(userCondominium);
        await _userCondominiumRepository.SaveChangesAsync();

        var admins = await _userRepository.FindAsync(u => u.CondominiumId == condominiumId && u.Role == UserRole.Admin && u.IsActive);
        foreach (var admin in admins)
        {
            await _emailService.SendAsync(
                admin.Email,
                "Novo pedido de registo pendente – Habitus",
                $"Olá {admin.Name},\n\n" +
                $"O utilizador {user.Name} ({user.Email}) submeteu um pedido de registo para a fração {unit.Number}.\n\n" +
                $"Aceda à plataforma para aprovar ou recusar o pedido.\n\nEquipa Habitus");
        }

        return (new RegisterResidentResponse
        {
            Message = "Registo submetido com sucesso. Aguarda aprovação pelo administrador ou por um residente da mesma fração."
        }, null);
    }

    public async Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        var users = await _userRepository.FindAsync(u => u.Email == request.Email);
        var user = users.FirstOrDefault();
        if (user == null) return false;

        var resetToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        user.PasswordResetToken = resetToken;
        user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(1);

        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        var frontendBaseUrl = _configuration["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var resetLink = $"{frontendBaseUrl}/reset-password?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(resetToken)}";
        var emailBody = $@"
Hello {user.Name},

You requested a password reset. Click the link below to set a new password:

{resetLink}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
Habitus Team
";
        await _emailService.SendAsync(
            user.Email,
            "Password Reset Request",
            emailBody,
            EmailSenderType.System);
        return true;
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request)
    {
        var users = await _userRepository.FindAsync(u => u.Email == request.Email);
        var user = users.FirstOrDefault();

        if (user == null || user.PasswordResetToken != request.Token || user.PasswordResetTokenExpiry < DateTime.UtcNow)
        {
            return false;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;
        user.LastPasswordChangedAt = DateTime.UtcNow;

        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();
        return true;
    }

    private async Task<AuthResponse> CreateTwoFactorChallengeResponseAsync(User user, string? ipAddress, string? userAgent)
    {
        var activeChallenges = await _authChallengeRepository.FindAsync(c =>
            c.UserId == user.Id &&
            c.Purpose == AuthChallengePurpose.TwoFactorLogin &&
            !c.UsedAt.HasValue &&
            c.ExpiresAt > DateTime.UtcNow);
        foreach (var challenge in activeChallenges)
        {
            challenge.UsedAt = DateTime.UtcNow;
            _authChallengeRepository.Update(challenge);
        }
        await _authChallengeRepository.SaveChangesAsync();

        var newChallenge = new AuthChallenge
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Purpose = AuthChallengePurpose.TwoFactorLogin,
            ExpiresAt = DateTime.UtcNow.Add(LoginChallengeDuration),
            IpAddress = ipAddress,
            UserAgent = userAgent,
        };

        await _authChallengeRepository.AddAsync(newChallenge);
        await _authChallengeRepository.SaveChangesAsync();

        return new AuthResponse
        {
            Email = user.Email,
            Name = user.Name,
            Role = (int)user.Role,
            CondominiumId = user.CondominiumId,
            UnitId = user.UnitId,
            AccessibleCondominiums = await GetAccessibleCondominiumsAsync(user),
            RequiresTwoFactor = true,
            ChallengeId = newChallenge.Id.ToString(),
            AvailableTwoFactorMethods = ["totp", "recovery_code"],
        };
    }

    private async Task<AuthResponse> CreateAuthenticatedResponseAsync(User user)
    {
        return new AuthResponse
        {
            Token = GenerateToken(user),
            Email = user.Email,
            Name = user.Name,
            Role = (int)user.Role,
            CondominiumId = user.CondominiumId,
            UnitId = user.UnitId,
            AccessibleCondominiums = await GetAccessibleCondominiumsAsync(user),
            RequiresTwoFactor = false,
        };
    }

    private async Task<List<Guid>> GetAccessibleCondominiumsAsync(User user)
    {
        if (user.UserCondominiums.Count > 0)
        {
            return user.UserCondominiums.Select(uc => uc.CondominiumId).ToList();
        }

        var loadedUser = await _userRepository.GetByIdWithIncludesAsync(user.Id, "UserCondominiums.Condominium");
        return loadedUser?.UserCondominiums.Select(uc => uc.CondominiumId).ToList() ?? [];
    }

    private bool ValidateTotpCode(User user, string code)
    {
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(user.TwoFactorSecretEncrypted))
        {
            return false;
        }

        var manualEntryKey = _encryptionService.Decrypt(user.TwoFactorSecretEncrypted);
        var secretBytes = Base32Encoding.ToBytes(manualEntryKey);
        var totp = new Totp(secretBytes);
        return totp.VerifyTotp(code.Replace(" ", string.Empty), out _, new VerificationWindow(previous: 1, future: 1));
    }

    private async Task<List<string>> ReplaceRecoveryCodesAsync(Guid userId)
    {
        var existing = await _userRecoveryCodeRepository.FindAsync(c => c.UserId == userId);
        foreach (var code in existing)
        {
            _userRecoveryCodeRepository.Remove(code);
        }
        await _userRecoveryCodeRepository.SaveChangesAsync();

        var codes = GenerateRecoveryCodes();
        foreach (var code in codes)
        {
            await _userRecoveryCodeRepository.AddAsync(new UserRecoveryCode
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                CodeHash = BCrypt.Net.BCrypt.HashPassword(code),
                CreatedAt = DateTime.UtcNow,
            });
        }
        await _userRecoveryCodeRepository.SaveChangesAsync();
        return codes;
    }

    private async Task<bool> ConsumeRecoveryCodeAsync(Guid userId, string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return false;
        }

        var recoveryCodes = await _userRecoveryCodeRepository.FindAsync(c => c.UserId == userId && !c.UsedAt.HasValue);
        var matchingCode = recoveryCodes.FirstOrDefault(c => BCrypt.Net.BCrypt.Verify(code.Trim(), c.CodeHash));
        if (matchingCode == null)
        {
            return false;
        }

        matchingCode.UsedAt = DateTime.UtcNow;
        _userRecoveryCodeRepository.Update(matchingCode);
        await _userRecoveryCodeRepository.SaveChangesAsync();
        return true;
    }

    private static List<string> GenerateRecoveryCodes()
    {
        var recoveryCodes = new List<string>();
        for (var index = 0; index < 8; index++)
        {
            var bytes = RandomNumberGenerator.GetBytes(5);
            var token = Convert.ToHexString(bytes);
            recoveryCodes.Add($"{token[..5]}-{token[5..]}");
        }

        return recoveryCodes;
    }

    private string GenerateToken(User user)
    {
        var secretKey = _configuration["JwtSettings:SecretKey"]
            ?? throw new InvalidOperationException("JwtSettings:SecretKey is not configured.");
        var expiryMinutes = _configuration["JwtSettings:ExpiryMinutes"]
            ?? throw new InvalidOperationException("JwtSettings:ExpiryMinutes is not configured.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };

        if (user.CondominiumId.HasValue)
        {
            claims.Add(new Claim("CondominiumId", user.CondominiumId.Value.ToString()));
        }

        if (user.UnitId.HasValue)
        {
            claims.Add(new Claim("UnitId", user.UnitId.Value.ToString()));
        }

        var token = new JwtSecurityToken(
            issuer: _configuration["JwtSettings:Issuer"],
            audience: _configuration["JwtSettings:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(double.Parse(expiryMinutes)),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<bool> IsCondominiumActiveForUserAsync(User user)
    {
        if (user.Role == UserRole.Manager || !user.CondominiumId.HasValue)
        {
            return true;
        }

        var condominium = await _condominiumRepository.GetByIdAsync(user.CondominiumId.Value);
        return condominium?.IsActive == true;
    }
}

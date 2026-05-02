using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Habitus.Application.DTOs.Auth;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Habitus.Application.Services;

public class AuthService
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<UserCondominium> _userCondominiumRepository;
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<Unit> _unitRepository;
    private readonly IConfiguration _configuration;
    private readonly IEmailService _emailService;

    public AuthService(
        IRepository<User> userRepository,
        IRepository<UserCondominium> userCondominiumRepository,
        IRepository<Condominium> condominiumRepository,
        IRepository<Unit> unitRepository,
        IConfiguration configuration,
        IEmailService emailService)
    {
        _userRepository = userRepository;
        _userCondominiumRepository = userCondominiumRepository;
        _condominiumRepository = condominiumRepository;
        _unitRepository = unitRepository;
        _configuration = configuration;
        _emailService = emailService;
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var users = await _userRepository.FindWithIncludesAsync(
            u => u.Email == request.Email,
            "UserCondominiums.Condominium");
        
        var user = users.FirstOrDefault();
        if (user == null) return null;
        if (!user.IsActive) return null;
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash)) return null;
        
        // Update last login
        user.LastLoginAt = DateTime.UtcNow;
        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();

        return new AuthResponse
        {
            Token = GenerateToken(user),
            Email = user.Email,
            Name = user.Name,
            Role = (int)user.Role,
            CondominiumId = user.CondominiumId,
            UnitId = user.UnitId,
            AccessibleCondominiums = user.UserCondominiums.Select(uc => uc.CondominiumId).ToList()
        };
    }

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request)
    {
        var existing = await _userRepository.FindAsync(u => u.Email == request.Email);
        if (existing.Any()) return null;

        // Parse role
        if (!Enum.TryParse<UserRole>(request.Role, true, out var userRole))
        {
            return null;
        }

        // Validate role-specific requirements
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
            CreatedAt = DateTime.UtcNow
        };
        
        await _userRepository.AddAsync(user);
        await _userRepository.SaveChangesAsync();
        
        // For non-Manager users with a condominium, create UserCondominium relationship
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

        return new AuthResponse
        {
            Token = GenerateToken(user),
            Email = user.Email,
            Name = user.Name,
            Role = (int)user.Role,
            CondominiumId = user.CondominiumId,
            UnitId = user.UnitId,
            AccessibleCondominiums = new List<Guid>()
        };
    }

    /// <summary>
    /// Public self-registration for residents. Creates the user as inactive (pending approval).
    /// The user will be activated by an Admin or by an existing resident of the same unit.
    /// </summary>
    public async Task<(RegisterResidentResponse? response, string? error)> RegisterResidentAsync(
        Guid condominiumId, RegisterResidentRequest request)
    {
        // Validate condominium exists
        var condominium = await _condominiumRepository.GetByIdAsync(condominiumId);
        if (condominium == null)
            return (null, "Condomínio não encontrado.");

        // Email must be unique
        var existing = await _userRepository.FindAsync(u => u.Email == request.Email);
        if (existing.Any())
            return (null, "Este email já está registado.");

        // Unit must exist and belong to the condominium
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
            IsActive = false, // Pending approval
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddAsync(user);
        await _userRepository.SaveChangesAsync();

        // Create condominium association
        var userCondominium = new UserCondominium
        {
            UserId = user.Id,
            CondominiumId = condominiumId,
            GrantedAt = DateTime.UtcNow,
            CanManage = false
        };
        await _userCondominiumRepository.AddAsync(userCondominium);
        await _userCondominiumRepository.SaveChangesAsync();

        // Notify admins of the condominium
        var admins = await _userRepository.FindAsync(
            u => u.CondominiumId == condominiumId && u.Role == UserRole.Admin && u.IsActive);
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

        var resetToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
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
        await _emailService.SendAsync(user.Email, "Password Reset Request", emailBody);
        return true;
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request)
    {
        var users = await _userRepository.FindAsync(u => u.Email == request.Email);
        var user = users.FirstOrDefault();

        if (user == null ||
            user.PasswordResetToken != request.Token ||
            user.PasswordResetTokenExpiry < DateTime.UtcNow)
        {
            return false;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;

        _userRepository.Update(user);
        await _userRepository.SaveChangesAsync();
        return true;
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

        // Add condominium claim for scoped access
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
}

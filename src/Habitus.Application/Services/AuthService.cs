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
    private readonly IRepository<Resident> _repository;
    private readonly IConfiguration _configuration;
    private readonly IEmailService _emailService;

    public AuthService(IRepository<Resident> repository, IConfiguration configuration, IEmailService emailService)
    {
        _repository = repository;
        _configuration = configuration;
        _emailService = emailService;
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var residents = await _repository.FindAsync(r => r.Email == request.Email);
        var resident = residents.FirstOrDefault();
        if (resident == null) return null;
        if (!BCrypt.Net.BCrypt.Verify(request.Password, resident.PasswordHash)) return null;
        return new AuthResponse
        {
            Token = GenerateToken(resident),
            Email = resident.Email,
            Name = resident.Name,
            Role = resident.Role.ToString()
        };
    }

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request)
    {
        var existing = await _repository.FindAsync(r => r.Email == request.Email);
        if (existing.Any()) return null;

        var resident = new Resident
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            UnitId = request.UnitId,
            Role = Enum.Parse<ResidentRole>(request.Role),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow
        };
        await _repository.AddAsync(resident);
        await _repository.SaveChangesAsync();
        return new AuthResponse
        {
            Token = GenerateToken(resident),
            Email = resident.Email,
            Name = resident.Name,
            Role = resident.Role.ToString()
        };
    }

    public async Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        var residents = await _repository.FindAsync(r => r.Email == request.Email);
        var resident = residents.FirstOrDefault();
        if (resident == null) return false;

        var resetToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        resident.PasswordResetToken = resetToken;
        resident.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(1);

        _repository.Update(resident);
        await _repository.SaveChangesAsync();

        var frontendBaseUrl = _configuration["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var resetLink = $"{frontendBaseUrl}/reset-password?email={Uri.EscapeDataString(resident.Email)}&token={Uri.EscapeDataString(resetToken)}";
        var emailBody = $@"
Hello {resident.Name},

You requested a password reset. Click the link below to set a new password:

{resetLink}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
Habitus Team
";
        await _emailService.SendAsync(resident.Email, "Password Reset Request", emailBody);
        return true;
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request)
    {
        var residents = await _repository.FindAsync(r => r.Email == request.Email);
        var resident = residents.FirstOrDefault();

        if (resident == null ||
            resident.PasswordResetToken != request.Token ||
            resident.PasswordResetTokenExpiry < DateTime.UtcNow)
        {
            return false;
        }

        resident.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        resident.PasswordResetToken = null;
        resident.PasswordResetTokenExpiry = null;

        _repository.Update(resident);
        await _repository.SaveChangesAsync();
        return true;
    }

    private string GenerateToken(Resident resident)
    {
        var secretKey = _configuration["JwtSettings:SecretKey"]
            ?? throw new InvalidOperationException("JwtSettings:SecretKey is not configured.");
        var expiryMinutes = _configuration["JwtSettings:ExpiryMinutes"]
            ?? throw new InvalidOperationException("JwtSettings:ExpiryMinutes is not configured.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, resident.Id.ToString()),
            new Claim(ClaimTypes.Email, resident.Email),
            new Claim(ClaimTypes.Name, resident.Name),
            new Claim(ClaimTypes.Role, resident.Role.ToString())
        };
        var token = new JwtSecurityToken(
            issuer: _configuration["JwtSettings:Issuer"],
            audience: _configuration["JwtSettings:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(double.Parse(expiryMinutes)),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

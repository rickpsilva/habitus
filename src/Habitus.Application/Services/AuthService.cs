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

    public AuthService(IRepository<Resident> repository, IConfiguration configuration)
    {
        _repository = repository;
        _configuration = configuration;
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

    private string GenerateToken(Resident resident)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JwtSettings:SecretKey"]!));
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
            expires: DateTime.UtcNow.AddMinutes(double.Parse(_configuration["JwtSettings:ExpiryMinutes"]!)),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

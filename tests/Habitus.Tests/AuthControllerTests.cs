using System.Security.Claims;
using Habitus.Api.Controllers;
using Habitus.Application.DTOs.Auth;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;

namespace Habitus.Tests;

/// <summary>
/// Unit tests for <see cref="AuthController"/>. Focused on impersonation endpoints where
/// controller-level claim handling matters.
/// </summary>
public class AuthControllerTests
{
    private readonly Mock<AuthService> _authServiceMock;
    private readonly AuthController _controller;

    public AuthControllerTests()
    {
        _authServiceMock = new Mock<AuthService>(
            Mock.Of<Application.Interfaces.IRepository<User>>(),
            Mock.Of<Application.Interfaces.IRepository<UserCondominium>>(),
            Mock.Of<Application.Interfaces.IRepository<Condominium>>(),
            Mock.Of<Application.Interfaces.IRepository<Unit>>(),
            Mock.Of<Application.Interfaces.IRepository<UnitMembership>>(),
            Mock.Of<Application.Interfaces.IRepository<UserAuthProvider>>(),
            Mock.Of<Application.Interfaces.IRepository<UserRecoveryCode>>(),
            Mock.Of<Application.Interfaces.IRepository<AuthChallenge>>(),
            Mock.Of<Application.Interfaces.IRepository<ImpersonationSession>>(),
            new ConfigurationManager(),
            Mock.Of<Application.Interfaces.IEmailService>(),
            Mock.Of<Application.Interfaces.IEncryptionService>());

        _controller = new AuthController(_authServiceMock.Object);
    }

    [Fact]
    public async Task EndImpersonation_WithImpersonationToken_UsesImpersonatorIdClaim()
    {
        // Arrange
        var impersonatorId = Guid.NewGuid();
        var impersonatedId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, impersonatedId.ToString()),
                    new Claim(ClaimTypes.Role, "Admin"),
                    new Claim("CondominiumId", condominiumId.ToString()),
                    new Claim("IsImpersonation", "true"),
                    new Claim("ImpersonatorUserId", impersonatorId.ToString()),
                ], "TestAuth")),
            },
        };

        var expectedResponse = new AuthResponse
        {
            Token = "manager-token",
            Name = "Manager",
            Role = (int)UserRole.Manager,
        };

        _authServiceMock
            .Setup(s => s.EndImpersonationAsync(impersonatorId))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await _controller.EndImpersonation();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.Same(expectedResponse, okResult.Value);
        _authServiceMock.Verify(s => s.EndImpersonationAsync(impersonatorId), Times.Once);
    }

    [Fact]
    public async Task EndImpersonation_WithoutImpersonationToken_ReturnsBadRequest()
    {
        // Arrange
        var managerId = Guid.NewGuid();
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, managerId.ToString()),
                    new Claim(ClaimTypes.Role, "Manager"),
                ], "TestAuth")),
            },
        };

        // Act
        var result = await _controller.EndImpersonation();

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
        _authServiceMock.Verify(s => s.EndImpersonationAsync(It.IsAny<Guid>()), Times.Never);
    }
}

using System.Security.Claims;
using Habitus.Api.Middleware;
using Habitus.Application.Interfaces;
using Habitus.Application.DTOs.Users;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;

namespace Habitus.Tests;

public class GdprConsentMiddlewareTests
{
    private static GdprConsentMiddleware CreateMiddleware(RequestDelegate next)
    {
        var logger = new Mock<ILogger<GdprConsentMiddleware>>();
        return new GdprConsentMiddleware(next, logger.Object);
    }

    private static DefaultHttpContext BuildAuthenticatedContext(string path, string userId)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim(ClaimTypes.Role, "Resident"),
        ],
        authenticationType: "Test"));
        return context;
    }

    [Fact]
    public async Task InvokeAsync_WhenPathIsExcluded_ShouldBypassConsentValidation()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var userService = new Mock<IUserService>(MockBehavior.Strict);
        var context = BuildAuthenticatedContext("/api/users/me/gdpr-consent/status", Guid.NewGuid().ToString());

        await middleware.InvokeAsync(context, userService.Object);

        nextCalled.Should().BeTrue();
        userService.Verify(s => s.HasGdprConsentAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task InvokeAsync_WhenNonApiPath_ShouldBypassConsentValidation()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var userService = new Mock<IUserService>(MockBehavior.Strict);
        var context = BuildAuthenticatedContext("/health", Guid.NewGuid().ToString());

        await middleware.InvokeAsync(context, userService.Object);

        nextCalled.Should().BeTrue();
        userService.Verify(s => s.HasGdprConsentAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task InvokeAsync_WhenAuthenticatedWithoutConsent_ShouldReturn403()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var userId = Guid.NewGuid().ToString();
        var userService = new Mock<IUserService>();
        userService.Setup(s => s.HasGdprConsentAsync(userId)).ReturnsAsync(false);

        var context = BuildAuthenticatedContext("/api/users/paged", userId);

        await middleware.InvokeAsync(context, userService.Object);

        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        nextCalled.Should().BeFalse();
        userService.Verify(s => s.HasGdprConsentAsync(userId), Times.Once);
    }

    [Fact]
    public async Task InvokeAsync_WhenAuthenticatedWithConsent_ShouldCallNext()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var userId = Guid.NewGuid().ToString();
        var userService = new Mock<IUserService>();
        userService.Setup(s => s.HasGdprConsentAsync(userId)).ReturnsAsync(true);

        var context = BuildAuthenticatedContext("/api/users/paged", userId);

        await middleware.InvokeAsync(context, userService.Object);

        nextCalled.Should().BeTrue();
        userService.Verify(s => s.HasGdprConsentAsync(userId), Times.Once);
    }

    [Fact]
    public async Task InvokeAsync_WhenUnauthenticated_ShouldCallNextWithoutCheckingConsent()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var userService = new Mock<IUserService>(MockBehavior.Strict);
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/users/paged";

        await middleware.InvokeAsync(context, userService.Object);

        nextCalled.Should().BeTrue();
        userService.Verify(s => s.HasGdprConsentAsync(It.IsAny<string>()), Times.Never);
    }
}

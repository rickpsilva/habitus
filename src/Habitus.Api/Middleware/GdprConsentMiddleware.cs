using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Habitus.Application.Interfaces;
using System.Security.Claims;

namespace Habitus.Api.Middleware
{
    public class GdprConsentMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<GdprConsentMiddleware> _logger;

        public GdprConsentMiddleware(RequestDelegate next, ILogger<GdprConsentMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, IUserService userService)
        {
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;

            if (!path.StartsWith("/api/") || IsExcludedPath(path))
            {
                await _next(context);
                return;
            }

            // Only block authenticated users
            if (context.User.Identity?.IsAuthenticated == true)
            {
                var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!string.IsNullOrEmpty(userId))
                {
                    var hasConsent = await userService.HasGdprConsentAsync(userId);
                    if (!hasConsent)
                    {
                        _logger.LogInformation("Blocked request without GDPR consent for user {UserId} on path {Path}", userId, path);
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        await context.Response.WriteAsync("RGPD consent required.");
                        return;
                    }
                }
            }

            await _next(context);
        }

        private static bool IsExcludedPath(string path)
        {
            return path.StartsWith("/api/auth")
                || path.StartsWith("/api/users/me")
                || path.StartsWith("/api/health")
                || path.StartsWith("/health");
        }
    }
}

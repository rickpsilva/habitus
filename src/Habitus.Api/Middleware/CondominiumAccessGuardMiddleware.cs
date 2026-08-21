using System.Security.Claims;
using Habitus.Domain.Entities;
using Habitus.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Habitus.Api.Middleware;

public class CondominiumAccessGuardMiddleware
{
    private readonly RequestDelegate _next;

    public CondominiumAccessGuardMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, HabitusDbContext dbContext)
    {
        var user = context.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        // Check if this is an impersonation session
        var isImpersonation = user.FindFirstValue("IsImpersonation") == "true";
        var role = user.FindFirstValue(ClaimTypes.Role);

        // If impersonating, use the impersonated role and condominium for scope checks
        if (isImpersonation)
        {
            var impCondominiumClaim = user.FindFirstValue("CondominiumId");
            if (!Guid.TryParse(impCondominiumClaim, out var impCondominiumId))
            {
                await _next(context);
                return;
            }

            var impIsActive = await dbContext.Condominiums
                .AsNoTracking()
                .Where(c => c.Id == impCondominiumId)
                .Select(c => (bool?)c.IsActive)
                .FirstOrDefaultAsync();

            if (impIsActive != true)
            {
                context.Response.StatusCode = StatusCodes.Status423Locked;
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "condominium_inactive",
                    message = "Condominium is inactive. Please contact your condominium administrator."
                });
                return;
            }

            // Check impersonation expiry (Unix timestamp)
            var expiresClaim = user.FindFirstValue("ImpersonationExpiresAt");
            if (long.TryParse(expiresClaim, out var expiresAtUnix))
            {
                var expiresAt = DateTimeOffset.FromUnixTimeSeconds(expiresAtUnix).UtcDateTime;
                if (expiresAt <= DateTime.UtcNow)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        code = "impersonation_expired",
                        message = "Impersonation session has expired."
                    });
                    return;
                }
            }

            await _next(context);
            return;
        }

        // Normal (non-impersonation) flow
        if (string.Equals(role, UserRole.Manager.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var condominiumClaim = user.FindFirstValue("CondominiumId");
        if (!Guid.TryParse(condominiumClaim, out var condominiumId))
        {
            await _next(context);
            return;
        }

        var isActive = await dbContext.Condominiums
            .AsNoTracking()
            .Where(c => c.Id == condominiumId)
            .Select(c => (bool?)c.IsActive)
            .FirstOrDefaultAsync();

        if (isActive != true)
        {
            context.Response.StatusCode = StatusCodes.Status423Locked;
            await context.Response.WriteAsJsonAsync(new
            {
                code = "condominium_inactive",
                message = "Condominium is inactive. Please contact your condominium administrator."
            });
            return;
        }

        await _next(context);
    }
}

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

        var role = user.FindFirstValue(ClaimTypes.Role);
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

using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Habitus.Api.Middleware;

public sealed class RequireFeatureAttribute : TypeFilterAttribute
{
    public RequireFeatureAttribute(string featureKey) : base(typeof(RequireFeatureFilter))
    {
        Arguments = [featureKey];
    }
}

public sealed class RequireFeatureFilter : IAsyncActionFilter
{
    private readonly string _featureKey;
    private readonly IFeatureEntitlementService _entitlementService;

    public RequireFeatureFilter(
        string featureKey,
        IFeatureEntitlementService entitlementService)
    {
        _featureKey = featureKey;
        _entitlementService = entitlementService;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;

        if (user.IsInRole(UserRole.Manager.ToString()))
        {
            await next();
            return;
        }

        var condominiumClaim = user.FindFirst("CondominiumId")?.Value;
        if (!Guid.TryParse(condominiumClaim, out var condominiumId))
        {
            context.Result = new ForbidResult();
            return;
        }

        var enabled = await _entitlementService.IsFeatureEnabledForCondominiumAsync(condominiumId, _featureKey);

        if (!enabled)
        {
            context.Result = new ObjectResult(new { message = $"Feature '{_featureKey}' is not available for the current subscription." })
            {
                StatusCode = StatusCodes.Status403Forbidden,
            };
            return;
        }

        await next();
    }
}

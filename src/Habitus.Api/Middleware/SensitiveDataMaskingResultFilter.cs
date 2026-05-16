using System.Security.Claims;
using Habitus.Application.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Habitus.Api.Middleware;

public class SensitiveDataMaskingResultFilter : IAsyncResultFilter
{
    public Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        if (context.Result is ObjectResult objectResult && objectResult.Value != null)
        {
            var role = context.HttpContext.User.FindFirstValue(ClaimTypes.Role);
            DataMaskingHelper.ApplySensitiveDataMaskingRecursively(objectResult.Value, role);
        }

        return next();
    }
}

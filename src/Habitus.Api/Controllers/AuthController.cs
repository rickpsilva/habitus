using Habitus.Application.DTOs.Auth;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService) => _authService = authService;

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var result = await _authService.RegisterAsync(request);
            if (result == null) return Conflict("Email already registered.");
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request, GetIpAddress(), GetUserAgent());
        if (result == null) return Unauthorized("Invalid credentials.");
        return Ok(result);
    }

    [HttpPost("login/2fa")]
    public async Task<IActionResult> CompleteTwoFactorLogin([FromBody] CompleteTwoFactorLoginRequest request)
    {
        var result = await _authService.CompleteTwoFactorLoginAsync(request, GetIpAddress(), GetUserAgent());
        if (result == null) return Unauthorized("Invalid or expired authentication challenge.");
        return Ok(result);
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var result = await _authService.ForgotPasswordAsync(request);
        if (!result) return BadRequest("Email not found.");
        return Ok(new { message = "Password reset email sent. Check your email for instructions." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var result = await _authService.ResetPasswordAsync(request);
        if (!result) return BadRequest("Invalid or expired reset token.");
        return Ok(new { message = "Password reset successfully." });
    }

    [HttpGet("security")]
    [Authorize]
    public async Task<IActionResult> GetSecurityOverview()
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _authService.GetTwoFactorSecurityAsync(userId);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost("2fa/setup")]
    [Authorize]
    public async Task<IActionResult> SetupTwoFactor()
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _authService.SetupTwoFactorAsync(userId);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost("2fa/verify-setup")]
    [Authorize]
    public async Task<IActionResult> VerifyTwoFactorSetup([FromBody] VerifyTwoFactorSetupRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _authService.VerifyTwoFactorSetupAsync(userId, request);
        if (result == null) return BadRequest("Invalid verification code.");
        return Ok(result);
    }

    [HttpPost("2fa/disable")]
    [Authorize]
    public async Task<IActionResult> DisableTwoFactor([FromBody] DisableTwoFactorRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _authService.DisableTwoFactorAsync(userId, request);
        if (!result) return BadRequest("Unable to disable two-factor authentication.");
        return Ok(new { message = "Two-factor authentication disabled." });
    }

    [HttpPost("2fa/recovery-codes/regenerate")]
    [Authorize]
    public async Task<IActionResult> RegenerateRecoveryCodes([FromBody] RegenerateRecoveryCodesRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _authService.RegenerateRecoveryCodesAsync(userId, request);
        if (result == null) return BadRequest("Unable to regenerate recovery codes.");
        return Ok(result);
    }

    [HttpGet("external/{provider}/start")]
    public IActionResult StartExternalLogin(string provider)
    {
        if (!TryGetExternalProvider(provider, out var normalizedProvider))
        {
            return BadRequest("Unsupported external provider.");
        }

        var callbackUrl = Url.ActionLink(nameof(ExternalLoginCallback), values: new { provider = normalizedProvider.ToLowerInvariant() });
        if (string.IsNullOrWhiteSpace(callbackUrl))
        {
            return BadRequest("Unable to build callback URL.");
        }

        var properties = new AuthenticationProperties
        {
            RedirectUri = callbackUrl,
        };
        properties.Items["flow"] = "login";

        return Challenge(properties, normalizedProvider);
    }

    [HttpGet("external/{provider}/link")]
    [Authorize]
    public IActionResult StartExternalLink(string provider)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        if (!TryGetExternalProvider(provider, out var normalizedProvider))
        {
            return BadRequest("Unsupported external provider.");
        }

        var callbackUrl = Url.ActionLink(nameof(ExternalLoginCallback), values: new { provider = normalizedProvider.ToLowerInvariant() });
        if (string.IsNullOrWhiteSpace(callbackUrl))
        {
            return BadRequest("Unable to build callback URL.");
        }

        var properties = new AuthenticationProperties
        {
            RedirectUri = callbackUrl,
        };
        properties.Items["flow"] = "link";
        properties.Items["userId"] = userId.ToString();

        return Challenge(properties, normalizedProvider);
    }

    [HttpGet("external/{provider}/callback")]
    public async Task<IActionResult> ExternalLoginCallback(string provider)
    {
        if (!TryGetExternalProvider(provider, out var normalizedProvider, out var externalProvider))
        {
            return Redirect(BuildFrontendErrorRedirect("unsupported_provider"));
        }

        var authResult = await HttpContext.AuthenticateAsync("External");
        if (!authResult.Succeeded || authResult.Principal == null)
        {
            return Redirect(BuildFrontendErrorRedirect("external_auth_failed"));
        }

        var providerUserId = authResult.Principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? authResult.Principal.FindFirstValue("sub")
            ?? string.Empty;
        var providerEmail = authResult.Principal.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

        await HttpContext.SignOutAsync("External");

        if (string.IsNullOrWhiteSpace(providerUserId) || string.IsNullOrWhiteSpace(providerEmail))
        {
            return Redirect(BuildFrontendErrorRedirect("external_identity_incomplete"));
        }

        var flow = authResult.Properties?.Items.TryGetValue("flow", out var storedFlow) == true
            ? storedFlow
            : "login";

        if (string.Equals(flow, "link", StringComparison.OrdinalIgnoreCase))
        {
            var userIdRaw = authResult.Properties?.Items.TryGetValue("userId", out var storedUserId) == true
                ? storedUserId
                : null;
            if (!Guid.TryParse(userIdRaw, out var userId))
            {
                return Redirect(BuildFrontendProfileRedirect("link_failed"));
            }

            var linked = await _authService.LinkExternalProviderAsync(userId, externalProvider, providerUserId, providerEmail);
            return Redirect(BuildFrontendProfileRedirect(linked ? $"linked_{normalizedProvider.ToLowerInvariant()}" : "link_failed"));
        }

        var result = await _authService.LoginWithExternalProviderAsync(externalProvider, providerUserId, providerEmail, GetIpAddress(), GetUserAgent());
        if (result == null)
        {
            return Redirect(BuildFrontendErrorRedirect("external_login_denied"));
        }

        return Redirect(BuildFrontendAuthCallbackRedirect(result));
    }

    [HttpDelete("providers/{provider}")]
    [Authorize]
    public async Task<IActionResult> UnlinkExternalProvider(string provider)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized();
        }

        if (!TryGetExternalProvider(provider, out _, out var externalProvider))
        {
            return BadRequest("Unsupported external provider.");
        }

        var result = await _authService.UnlinkExternalProviderAsync(userId, externalProvider);
        if (!result) return NotFound();
        return NoContent();
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdClaim, out userId);
    }

    private string? GetIpAddress()
    {
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }

    private string? GetUserAgent()
    {
        return Request.Headers.UserAgent.ToString();
    }

    private bool TryGetExternalProvider(string provider, out string normalizedProvider)
    {
        normalizedProvider = string.Empty;
        if (provider.Equals("google", StringComparison.OrdinalIgnoreCase))
        {
            normalizedProvider = "Google";
            return true;
        }

        if (provider.Equals("microsoft", StringComparison.OrdinalIgnoreCase))
        {
            normalizedProvider = "Microsoft";
            return true;
        }

        return false;
    }

    private bool TryGetExternalProvider(string provider, out string normalizedProvider, out ExternalAuthProvider externalProvider)
    {
        externalProvider = ExternalAuthProvider.Google;
        if (!TryGetExternalProvider(provider, out normalizedProvider))
        {
            return false;
        }

        externalProvider = normalizedProvider == "Google"
            ? ExternalAuthProvider.Google
            : ExternalAuthProvider.Microsoft;
        return true;
    }

    private string BuildFrontendAuthCallbackRedirect(AuthResponse result)
    {
        var frontendBaseUrl = GetFrontendBaseUrl();
        var queryParams = new List<string>
        {
            $"email={Uri.EscapeDataString(result.Email)}",
            $"name={Uri.EscapeDataString(result.Name)}",
            $"role={result.Role}",
            $"requiresTwoFactor={result.RequiresTwoFactor.ToString().ToLowerInvariant()}"
        };

        if (!string.IsNullOrWhiteSpace(result.Token))
        {
            queryParams.Add($"token={Uri.EscapeDataString(result.Token)}");
        }

        if (!string.IsNullOrWhiteSpace(result.ChallengeId))
        {
            queryParams.Add($"challengeId={Uri.EscapeDataString(result.ChallengeId)}");
        }

        if (result.CondominiumId.HasValue)
        {
            queryParams.Add($"condominiumId={result.CondominiumId.Value}");
        }

        if (result.UnitId.HasValue)
        {
            queryParams.Add($"unitId={result.UnitId.Value}");
        }

        if (result.AccessibleCondominiums.Count > 0)
        {
            queryParams.Add($"accessibleCondominiums={Uri.EscapeDataString(string.Join(',', result.AccessibleCondominiums))}");
        }

        return $"{frontendBaseUrl}/auth/callback?{string.Join("&", queryParams)}";
    }

    private string BuildFrontendErrorRedirect(string errorCode)
    {
        return $"{GetFrontendBaseUrl()}/login?error={Uri.EscapeDataString(errorCode)}";
    }

    private string BuildFrontendProfileRedirect(string status)
    {
        return $"{GetFrontendBaseUrl()}/profile?securityStatus={Uri.EscapeDataString(status)}";
    }

    private string GetFrontendBaseUrl()
    {
        return HttpContext.RequestServices.GetRequiredService<IConfiguration>()["Frontend:BaseUrl"]?.TrimEnd('/')
            ?? "http://localhost:5173";
    }
}

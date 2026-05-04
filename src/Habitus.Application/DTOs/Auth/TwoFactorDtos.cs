namespace Habitus.Application.DTOs.Auth;

public class CompleteTwoFactorLoginRequest
{
    public string ChallengeId { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool UseRecoveryCode { get; set; }
}

public class TwoFactorSetupResponse
{
    public bool IsEnabled { get; set; }
    public string ManualEntryKey { get; set; } = string.Empty;
    public string OtpauthUri { get; set; } = string.Empty;
}

public class VerifyTwoFactorSetupRequest
{
    public string Code { get; set; } = string.Empty;
}

public class TwoFactorSetupCompleteResponse
{
    public bool TwoFactorEnabled { get; set; }
    public List<string> RecoveryCodes { get; set; } = new();
}

public class DisableTwoFactorRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool UseRecoveryCode { get; set; }
}

public class RegenerateRecoveryCodesRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool UseRecoveryCode { get; set; }
}

public class RecoveryCodesResponse
{
    public List<string> RecoveryCodes { get; set; } = new();
}

public class LinkedAuthProviderDto
{
    public string Provider { get; set; } = string.Empty;
    public string ProviderEmail { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
}

public class TwoFactorSecurityResponse
{
    public bool TwoFactorEnabled { get; set; }
    public int RecoveryCodesRemaining { get; set; }
    public List<LinkedAuthProviderDto> LinkedProviders { get; set; } = new();
}
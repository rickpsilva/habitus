namespace Habitus.Application.Interfaces;

/// <summary>
/// Raised when a GDPR/RGPD erasure request fails validation (wrong confirmation phrase, or a
/// missing/incorrect password). Carries a stable machine-readable <see cref="Code"/> the API maps
/// to an HTTP 400 body.
/// </summary>
public class ErasureValidationException : Exception
{
    public string Code { get; }

    public ErasureValidationException(string code, string message) : base(message) => Code = code;
}

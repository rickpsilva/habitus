namespace Habitus.Application.Interfaces;

/// <summary>
/// Raised when a Manager consent-authoring action is rejected (e.g. publishing a duplicate
/// <c>{Key, Version}</c>, or editing a missing definition). Carries a stable machine-readable
/// <see cref="Code"/> the API maps to an HTTP error body.
/// </summary>
public class ConsentAuthoringException : Exception
{
    public string Code { get; }

    public ConsentAuthoringException(string code, string message) : base(message) => Code = code;
}

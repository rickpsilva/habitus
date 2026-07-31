namespace Habitus.Domain.Entities;

/// <summary>
/// Platform-wide localization settings (single global row). Holds the <see cref="DefaultLanguage"/>
/// used as the fallback for every user whenever multilanguage is not available for their active
/// condominium's plan. Multilanguage itself is a subscription-plan entitlement, not stored here.
/// </summary>
public class LocalizationSettings
{
    public Guid Id { get; set; }

    public string DefaultLanguage { get; set; } = "pt";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

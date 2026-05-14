namespace Habitus.Domain.Entities;

public class UserGdprConsent
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public DateTime ConsentedAt { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public bool AcceptedTerms { get; set; }
    public bool AcceptedPrivacyPolicy { get; set; }
}

namespace Habitus.Domain.Entities;

public class CommunicationSettings
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    public Condominium? Condominium { get; set; }
    
    // Email Configuration
    public bool EmailEnabled { get; set; } = false;
    public string? EmailSmtpHost { get; set; }
    public int? EmailSmtpPort { get; set; }
    public string? EmailUsername { get; set; }
    public string? EmailPassword { get; set; }  // Should be encrypted in production
    public string? EmailFromAddress { get; set; }
    public string? EmailFromName { get; set; }
    public bool EmailUseSsl { get; set; } = true;
    
    // WhatsApp Configuration
    public bool WhatsAppEnabled { get; set; } = false;
    public string? WhatsAppPhoneNumber { get; set; }
    public string? WhatsAppApiKey { get; set; }  // For services like Twilio, etc.
    public string? WhatsAppApiProvider { get; set; }  // twilio, whatsapp-business-api, etc.
    public string? WhatsAppGroupId { get; set; }  // Optional: for group messaging
    
    // SMS Configuration (future)
    public bool SmsEnabled { get; set; } = false;
    public string? SmsProvider { get; set; }
    public string? SmsApiKey { get; set; }
    public string? SmsFromNumber { get; set; }
    
    // Announcements Configuration
    public bool AllowAnnouncementComments { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

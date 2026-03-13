namespace Habitus.Application.DTOs.Communication;

public class CommunicationSettingsDto
{
    public Guid Id { get; set; }
    public Guid CondominiumId { get; set; }
    
    // Email Configuration
    public bool EmailEnabled { get; set; }
    public string? EmailSmtpHost { get; set; }
    public int? EmailSmtpPort { get; set; }
    public string? EmailUsername { get; set; }
    public string? EmailFromAddress { get; set; }
    public string? EmailFromName { get; set; }
    public bool EmailUseSsl { get; set; }
    
    // WhatsApp Configuration
    public bool WhatsAppEnabled { get; set; }
    public string? WhatsAppPhoneNumber { get; set; }
    public string? WhatsAppApiProvider { get; set; }
    public string? WhatsAppGroupId { get; set; }
    
    // SMS Configuration (future)
    public bool SmsEnabled { get; set; }
    public string? SmsProvider { get; set; }
    public string? SmsFromNumber { get; set; }

    // Announcements Configuration
    public bool AllowAnnouncementComments { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdateCommunicationSettingsRequest
{
    // Email Configuration
    public bool EmailEnabled { get; set; }
    public string? EmailSmtpHost { get; set; }
    public int? EmailSmtpPort { get; set; }
    public string? EmailUsername { get; set; }
    public string? EmailPassword { get; set; }  // Only sent when updating password
    public string? EmailFromAddress { get; set; }
    public string? EmailFromName { get; set; }
    public bool EmailUseSsl { get; set; }
    
    // WhatsApp Configuration
    public bool WhatsAppEnabled { get; set; }
    public string? WhatsAppPhoneNumber { get; set; }
    public string? WhatsAppApiKey { get; set; }
    public string? WhatsAppApiProvider { get; set; }
    public string? WhatsAppGroupId { get; set; }
    
    // SMS Configuration (future)
    public bool SmsEnabled { get; set; }
    public string? SmsProvider { get; set; }
    public string? SmsApiKey { get; set; }
    public string? SmsFromNumber { get; set; }

    // Announcements Configuration
    public bool AllowAnnouncementComments { get; set; } = true;
}

namespace Habitus.Domain.Entities;

public enum AnnouncementCategory
{
    Works,              // Obras
    Noise,             // Barulho/Perturbação
    Mail,              // Correspondência
    General,           // Geral
    Urgent,            // Urgente
    Event              // Eventos
}

public enum AnnouncementStatus
{
    Draft,             // Rascunho
    PendingApproval,   // Aguarda aprovação do admin
    Published,         // Publicado
    Rejected,          // Rejeitado pelo admin
    Archived           // Arquivado
}

public class Announcement
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty; // Rich text content (HTML)
    public AnnouncementCategory Category { get; set; }
    public AnnouncementStatus Status { get; set; } = AnnouncementStatus.Draft;
    public bool IsAnonymous { get; set; } // Se true, mostra só fração, não nome
    public bool IsPinned { get; set; } // Admin pode fixar no topo
    public DateTime? ValidUntil { get; set; } // Data de validade/expiração (opcional)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    // Author info
    public Guid AuthorId { get; set; }
    public User Author { get; set; } = null!;
    
    // Condominium and Unit
    public Guid CondominiumId { get; set; }
    public Condominium Condominium { get; set; } = null!;
    
    public Guid? UnitId { get; set; } // Fração do autor
    public Unit? Unit { get; set; }
    
    // Approval info
    public Guid? ApprovedByUserId { get; set; }
    public User? ApprovedByUser { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectionReason { get; set; }
    
    // Relations
    public ICollection<AnnouncementAttachment> Attachments { get; set; } = new List<AnnouncementAttachment>();
    public ICollection<AnnouncementComment> Comments { get; set; } = new List<AnnouncementComment>();
    public ICollection<AnnouncementReadStatus> ReadStatuses { get; set; } = new List<AnnouncementReadStatus>();
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Habitus.Domain.Entities;

/// <summary>
/// Audit log for Manager impersonation sessions.
/// Records when a Manager assumes the identity of an Admin or Resident for support operations.
/// </summary>
public class ImpersonationSession
{
    public Guid Id { get; set; }

    /// <summary>
    /// The Manager who initiated the impersonation.
    /// </summary>
    [Required]
    public Guid ImpersonatorUserId { get; set; }

    [ForeignKey(nameof(ImpersonatorUserId))]
    public User ImpersonatorUser { get; set; } = null!;

    /// <summary>
    /// The target user being impersonated (Admin or Resident).
    /// </summary>
    [Required]
    public Guid ImpersonatedUserId { get; set; }

    [ForeignKey(nameof(ImpersonatedUserId))]
    public User ImpersonatedUser { get; set; } = null!;

    /// <summary>
    /// The condominium context for the impersonation.
    /// </summary>
    [Required]
    public Guid CondominiumId { get; set; }

    [ForeignKey(nameof(CondominiumId))]
    public Condominium Condominium { get; set; } = null!;

    /// <summary>
    /// Optional specific unit within the condominium.
    /// </summary>
    public Guid? UnitId { get; set; }

    [ForeignKey(nameof(UnitId))]
    public Unit? Unit { get; set; }

    /// <summary>
    /// When the impersonation session started.
    /// </summary>
    [Required]
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the impersonation session expires.
    /// </summary>
    [Required]
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// When the impersonation session ended (null if active).
    /// </summary>
    public DateTime? EndedAt { get; set; }

    /// <summary>
    /// Reason the session ended: ExplicitExit, Expired, Revoked.
    /// </summary>
    [MaxLength(50)]
    public string? EndReason { get; set; }

    /// <summary>
    /// IP address of the Manager when starting impersonation.
    /// </summary>
    [Required]
    [MaxLength(45)]
    public string IpAddress { get; set; } = string.Empty;

    /// <summary>
    /// User agent of the Manager's browser/client.
    /// </summary>
    [MaxLength(500)]
    public string? UserAgent { get; set; }

    /// <summary>
    /// Whether the session is currently active.
    /// </summary>
    [Required]
    public bool IsActive { get; set; } = true;
}
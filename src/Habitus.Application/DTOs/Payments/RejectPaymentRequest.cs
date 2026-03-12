using System.ComponentModel.DataAnnotations;

namespace Habitus.Application.DTOs.Payments;

public class RejectPaymentRequest
{
    [Required]
    [StringLength(500, ErrorMessage = "Rejection reason is required and must not exceed 500 characters")]
    public string RejectionReason { get; set; } = string.Empty;
}

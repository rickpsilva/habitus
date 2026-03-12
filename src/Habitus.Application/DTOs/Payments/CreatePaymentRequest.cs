using System.ComponentModel.DataAnnotations;

namespace Habitus.Application.DTOs.Payments;

public class CreatePaymentRequest
{
    [Required]
    public string Type { get; set; } = string.Empty; // MonthlyFee, ExtraordinaryFee, Reservation, Other
    
    [Required]
    public string Method { get; set; } = string.Empty; // BankTransfer, MBWay, Card
    
    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0")]
    public decimal Amount { get; set; }
    
    [Required]
    [StringLength(500)]
    public string Description { get; set; } = string.Empty;
    
    public Guid? ReservationId { get; set; } // Optional: link to a reservation if payment type is Reservation
}

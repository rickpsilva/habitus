namespace Habitus.Application.DTOs.Payments;

/// <summary>
/// Per-status tallies for a resident's payments within a single condominium, used to render the
/// status filter chips. <see cref="All"/> is the total across every status.
/// </summary>
public class PaymentStatusCountsDto
{
    public int All { get; set; }
    public int Pending { get; set; }
    public int Approved { get; set; }
    public int Rejected { get; set; }
    public int Cancelled { get; set; }
}

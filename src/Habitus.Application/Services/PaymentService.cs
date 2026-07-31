using Habitus.Application.DTOs.Common;
using Habitus.Application.DTOs.Financial;
using Habitus.Application.DTOs.Payments;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;

namespace Habitus.Application.Services;

public class PaymentService
{
    private readonly IRepository<Payment> _paymentRepository;
    private readonly IRepository<FinancialRecord> _financialRepository;
    private readonly IRepository<Notification> _notificationRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<Unit> _unitRepository;
    private readonly INotificationDispatchService _notificationDispatchService;

    public PaymentService(
        IRepository<Payment> paymentRepository,
        IRepository<FinancialRecord> financialRepository,
        IRepository<Notification> notificationRepository,
        IRepository<User> userRepository,
        IRepository<Unit> unitRepository,
        INotificationDispatchService notificationDispatchService)
    {
        _paymentRepository = paymentRepository;
        _financialRepository = financialRepository;
        _notificationRepository = notificationRepository;
        _userRepository = userRepository;
        _unitRepository = unitRepository;
        _notificationDispatchService = notificationDispatchService;
    }

    public async Task<PaymentDto> CreateAsync(CreatePaymentRequest request, Guid residentId, Guid unitId, Guid condominiumId)
    {
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            ResidentId = residentId,
            UnitId = unitId,
            CondominiumId = condominiumId,
            Type = Enum.Parse<PaymentType>(request.Type, ignoreCase: true),
            Method = Enum.Parse<PaymentMethod>(request.Method, ignoreCase: true),
            Amount = request.Amount,
            Description = request.Description,
            Status = PaymentStatus.Pending,
            CreatedDate = DateTime.UtcNow,
            ReservationId = request.ReservationId
        };

        // Populate quota period fields when type is MonthlyFee (Quotas)
        if (payment.Type == PaymentType.MonthlyFee && !string.IsNullOrWhiteSpace(request.QuotaPeriodicity))
        {
            payment.QuotaPeriodicity = Enum.Parse<QuotaPeriodicity>(request.QuotaPeriodicity, ignoreCase: true);
            payment.QuotaMonthStart = request.QuotaMonthStart;
            payment.QuotaMonthEnd = request.QuotaMonthEnd;
            payment.QuotaYear = request.QuotaYear ?? DateTime.UtcNow.Year;
        }

        await _paymentRepository.AddAsync(payment);
        await _paymentRepository.SaveChangesAsync();

        // Notify Admin about new pending payment
        var unit = await _unitRepository.GetByIdAsync(unitId);
        var resident = await _userRepository.GetByIdAsync(residentId);
        
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = "Novo Pagamento Pendente",
            Message = $"Pagamento de €{payment.Amount:F2} da fração {unit?.Number ?? "N/A"} por {resident?.Name ?? "Residente"} aguarda aprovação. Clique para visualizar.",
            Type = NotificationType.Info,
            TargetRole = "Admin",
            CondominiumId = condominiumId,
            SentAt = DateTime.UtcNow,
            IsRead = false
        };
        
        await _notificationRepository.AddAsync(notification);
        await _notificationRepository.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        return await MapToDtoAsync(payment);
    }

    public async Task<PaymentDto?> GetByIdAsync(Guid id)
    {
        var payment = await _paymentRepository.GetByIdAsync(id);
        return payment == null ? null : await MapToDtoAsync(payment);
    }

    public async Task<IEnumerable<PaymentDto>> GetByResidentAsync(Guid residentId)
    {
        var payments = await _paymentRepository.FindAsync(p => p.ResidentId == residentId);
        var orderedPayments = payments.OrderByDescending(p => p.CreatedDate);
        
        var dtos = new List<PaymentDto>();
        foreach (var payment in orderedPayments)
        {
            dtos.Add(await MapToDtoAsync(payment));
        }
        return dtos;
    }

    public async Task<IEnumerable<PaymentDto>> GetPendingAsync(Guid condominiumId)
    {
        var payments = await _paymentRepository.FindAsync(
            p => p.CondominiumId == condominiumId && p.Status == PaymentStatus.Pending);
        var orderedPayments = payments.OrderBy(p => p.CreatedDate);
        
        var dtos = new List<PaymentDto>();
        foreach (var payment in orderedPayments)
        {
            dtos.Add(await MapToDtoAsync(payment));
        }
        return dtos;
    }

    public async Task<PaginatedResponse<PaymentDto>> GetPagedAsync(Guid condominiumId, int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var paged = await _paymentRepository.GetPagedAsync(
            page,
            pageSize,
            p => p.CondominiumId == condominiumId,
            p => p.CreatedDate,
            descending: true);

        var items = new List<PaymentDto>();
        foreach (var payment in paged.Items)
        {
            items.Add(await MapToDtoAsync(payment));
        }

        return new PaginatedResponse<PaymentDto>
        {
            Items = items,
            Page = paged.Page,
            PageSize = paged.PageSize,
            TotalItems = paged.TotalItems,
            TotalPages = paged.TotalPages
        };
    }

    /// <summary>
    /// Returns a single page of the given resident's payments within one condominium. Filtering,
    /// ordering and paging run server-side (only the requested page is materialised and mapped).
    /// </summary>
    /// <remarks>
    /// <paramref name="status"/> is matched server-side via <see cref="Enum.TryParse{PaymentStatus}"/>
    /// (no JsonStringEnumConverter). <paramref name="search"/> matches the plain <c>Description</c>
    /// column case-insensitively.
    /// </remarks>
    public async Task<PaginatedResponse<PaymentDto>> GetPagedByResidentAsync(
        Guid residentId,
        Guid condominiumId,
        int page,
        int pageSize,
        string? status,
        string? search)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var hasStatus = !string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase)
            && Enum.TryParse<PaymentStatus>(status, ignoreCase: true, out _);
        PaymentStatus statusValue = PaymentStatus.Pending;
        if (hasStatus)
        {
            Enum.TryParse(status, ignoreCase: true, out statusValue);
        }

        var searchLower = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        var paged = await _paymentRepository.GetPagedAsync(
            page,
            pageSize,
            p => p.ResidentId == residentId &&
                 p.CondominiumId == condominiumId &&
                 (!hasStatus || p.Status == statusValue) &&
                 (searchLower == null || p.Description.ToLower().Contains(searchLower)),
            p => p.CreatedDate,
            descending: true);

        var items = new List<PaymentDto>();
        foreach (var payment in paged.Items)
        {
            items.Add(await MapToDtoAsync(payment));
        }

        return new PaginatedResponse<PaymentDto>
        {
            Items = items,
            Page = paged.Page,
            PageSize = paged.PageSize,
            TotalItems = paged.TotalItems,
            TotalPages = paged.TotalPages
        };
    }

    /// <summary>
    /// Returns per-status tallies for the given resident's payments within one condominium, computed
    /// with DB-level COUNTs (no DTO materialisation). <c>All</c> is the total across every status.
    /// </summary>
    public async Task<PaymentStatusCountsDto> GetResidentStatusCountsAsync(Guid residentId, Guid condominiumId)
    {
        var all = await _paymentRepository.CountAsync(
            p => p.ResidentId == residentId && p.CondominiumId == condominiumId);
        var pending = await _paymentRepository.CountAsync(
            p => p.ResidentId == residentId && p.CondominiumId == condominiumId && p.Status == PaymentStatus.Pending);
        var approved = await _paymentRepository.CountAsync(
            p => p.ResidentId == residentId && p.CondominiumId == condominiumId && p.Status == PaymentStatus.Approved);
        var rejected = await _paymentRepository.CountAsync(
            p => p.ResidentId == residentId && p.CondominiumId == condominiumId && p.Status == PaymentStatus.Rejected);
        var cancelled = await _paymentRepository.CountAsync(
            p => p.ResidentId == residentId && p.CondominiumId == condominiumId && p.Status == PaymentStatus.Cancelled);

        return new PaymentStatusCountsDto
        {
            All = all,
            Pending = pending,
            Approved = approved,
            Rejected = rejected,
            Cancelled = cancelled
        };
    }

    public async Task<PaymentDto> ApproveAsync(Guid paymentId, Guid adminUserId, ApprovePaymentRequest? request = null)
    {
        var payment = await _paymentRepository.GetByIdAsync(paymentId);
        if (payment == null)
            throw new InvalidOperationException("Payment not found");

        if (payment.Status != PaymentStatus.Pending)
            throw new InvalidOperationException("Payment is not pending");

        // Create financial record
        var resident = await _userRepository.GetByIdAsync(payment.ResidentId);
        var unit = await _unitRepository.GetByIdAsync(payment.UnitId);
        
        var financialRecord = new FinancialRecord
        {
            Id = Guid.NewGuid(),
            Type = FinancialType.Income,
            Amount = payment.Amount,
            Description = $"Pagamento de {payment.Type} - {resident?.Name ?? "Residente"}, Fração {unit?.Number ?? "N/A"} - {payment.Description}",
            Date = DateTime.UtcNow,
            FiscalYear = DateTime.UtcNow.Year,
            Category = payment.Type == PaymentType.MonthlyFee ? FinancialCategory.MonthlyFees :
                       payment.Type == PaymentType.ExtraordinaryFee ? FinancialCategory.ExtraordinaryFees :
                       FinancialCategory.OtherIncome,
            CondominiumId = payment.CondominiumId,
            ReceiptUrl = payment.ProofOfPaymentUrl
        };

        await _financialRepository.AddAsync(financialRecord);

        // Update payment
        payment.Status = PaymentStatus.Approved;
        payment.ProcessedDate = DateTime.UtcNow;
        payment.ProcessedByUserId = adminUserId;
        payment.FinancialRecordId = financialRecord.Id;

        _paymentRepository.Update(payment);

        // Send notification to resident
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = "Pagamento Aprovado",
            Message = $"O seu pagamento de €{payment.Amount:F2} foi aprovado e registado.",
            Type = NotificationType.Info,
            TargetRole = "",
            TargetUserId = payment.ResidentId,
            CondominiumId = payment.CondominiumId,
            IsRead = false,
            SentAt = DateTime.UtcNow
        };

        await _notificationRepository.AddAsync(notification);
        await _paymentRepository.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync(new[] { notification }, sendExternalChannels: false);

        return await MapToDtoAsync(payment);
    }

    public async Task<PaymentDto> RejectAsync(Guid paymentId, Guid adminUserId, RejectPaymentRequest request)
    {
        var payment = await _paymentRepository.GetByIdAsync(paymentId);
        if (payment == null)
            throw new InvalidOperationException("Payment not found");

        if (payment.Status != PaymentStatus.Pending)
            throw new InvalidOperationException("Payment is not pending");

        // Update payment
        payment.Status = PaymentStatus.Rejected;
        payment.ProcessedDate = DateTime.UtcNow;
        payment.ProcessedByUserId = adminUserId;
        payment.RejectionReason = request.RejectionReason;

        _paymentRepository.Update(payment);

        // Send notification to ALL users of the same unit (fraction)
        var unitUsers = (await _userRepository.FindAsync(u => u.UnitId == payment.UnitId && u.Role == UserRole.Resident))
            .ToList();

        var createdNotifications = new List<Notification>();

        foreach (var user in unitUsers)
        {
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                Title = "Pagamento Rejeitado",
                Message = $"O pagamento de €{payment.Amount:F2} foi rejeitado. Motivo: {request.RejectionReason}",
                Type = NotificationType.Alert,
                TargetRole = "",
                TargetUserId = user.Id,
                CondominiumId = payment.CondominiumId,
                IsRead = false,
                SentAt = DateTime.UtcNow
            };

            await _notificationRepository.AddAsync(notification);
            createdNotifications.Add(notification);
        }

        await _paymentRepository.SaveChangesAsync();
        await _notificationDispatchService.DispatchAsync(createdNotifications, sendExternalChannels: false);

        return await MapToDtoAsync(payment);
    }

    public async Task<bool> UpdateProofOfPaymentAsync(Guid paymentId, string proofUrl, Guid residentId)
    {
        var payment = await _paymentRepository.GetByIdAsync(paymentId);
        if (payment == null || payment.ResidentId != residentId)
            return false;

        if (payment.Status != PaymentStatus.Pending)
            return false;

        payment.ProofOfPaymentUrl = proofUrl;
        _paymentRepository.Update(payment);
        await _paymentRepository.SaveChangesAsync();
        return true;
    }

    public async Task<PaymentDto?> CancelAsync(Guid paymentId, Guid residentId)
    {
        var payment = await _paymentRepository.GetByIdAsync(paymentId);
        if (payment == null)
            return null;

        // Only the resident who created the payment can cancel it
        if (payment.ResidentId != residentId)
            throw new UnauthorizedAccessException("Only the payment creator can cancel it");

        // Can only cancel pending payments
        if (payment.Status != PaymentStatus.Pending)
            throw new InvalidOperationException("Only pending payments can be cancelled");

        payment.Status = PaymentStatus.Cancelled;
        payment.ProcessedDate = DateTime.UtcNow;

        _paymentRepository.Update(payment);
        await _paymentRepository.SaveChangesAsync();

        return await MapToDtoAsync(payment);
    }

    private async Task<PaymentDto> MapToDtoAsync(Payment payment)
    {
        var resident = await _userRepository.GetByIdAsync(payment.ResidentId);
        var unit = await _unitRepository.GetByIdAsync(payment.UnitId);
        User? processedBy = payment.ProcessedByUserId.HasValue 
            ? await _userRepository.GetByIdAsync(payment.ProcessedByUserId.Value) 
            : null;
        User? receiptIssuedBy = payment.ReceiptIssuedByUserId.HasValue
            ? await _userRepository.GetByIdAsync(payment.ReceiptIssuedByUserId.Value)
            : null;

        return new PaymentDto
        {
            Id = payment.Id,
            ResidentId = payment.ResidentId,
            ResidentName = resident?.Name ?? "Unknown",
            UnitId = payment.UnitId,
            UnitIdentifier = unit?.Number ?? "Unknown",
            CondominiumId = payment.CondominiumId,
            Type = payment.Type.ToString(),
            Method = payment.Method.ToString(),
            Amount = payment.Amount,
            Description = payment.Description,
            Status = payment.Status.ToString(),
            ProofOfPaymentUrl = payment.ProofOfPaymentUrl,
            CreatedDate = payment.CreatedDate,
            ProcessedDate = payment.ProcessedDate,
            RejectionReason = payment.RejectionReason,
            ProcessedByUserName = processedBy?.Name,
            FinancialRecordId = payment.FinancialRecordId,
            ReservationId = payment.ReservationId,
            ReceiptNumber = payment.ReceiptNumber,
            ReceiptYear = payment.ReceiptYear,
            ReceiptIssuedDate = payment.ReceiptIssuedDate,
            ReceiptIssuedByUserName = receiptIssuedBy?.Name,
            ReceiptPdfPath = payment.ReceiptPdfPath,
            QuotaPeriodicity = payment.QuotaPeriodicity?.ToString(),
            QuotaMonthStart = payment.QuotaMonthStart,
            QuotaMonthEnd = payment.QuotaMonthEnd,
            QuotaYear = payment.QuotaYear
        };
    }
}

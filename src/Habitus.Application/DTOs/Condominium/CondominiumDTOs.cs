using Habitus.Application.Attributes;

namespace Habitus.Application.DTOs.Condominium;

public class CreateCondominiumRequest
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? TaxId { get; set; }
    public string? Email { get; set; }
}

public class UpdateCondominiumRequest
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? TaxId { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; }
}

public class UpdateCondominiumEmailRequest
{
    public string? Email { get; set; }
}

public class CondominiumResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    [SensitiveData(SensitiveDataType.TaxId, RequiresRole = "Manager,Admin")]
    public string? TaxId { get; set; }
    public string? Email { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
    public int TotalUnits { get; set; }
    public int TotalUsers { get; set; }
}

public class CondominiumDetailResponse : CondominiumResponse
{
    public List<UserSummary> Admins { get; set; } = new();
    public List<UnitSummary> Units { get; set; } = new();
}

public class UserSummary
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public class UnitSummary
{
    public Guid Id { get; set; }
    public string Number { get; set; } = string.Empty;
    public int Floor { get; set; }
    public string Type { get; set; } = string.Empty;
}

public class PaymentMethodsDto
{
    [SensitiveData(SensitiveDataType.Iban, RequiresRole = "Manager,Admin")]
    public string? Iban { get; set; }
    public string? Instructions { get; set; }
    [SensitiveData(SensitiveDataType.Phone, RequiresRole = "Manager,Admin")]
    public string? MbWay { get; set; }
    [SensitiveData(SensitiveDataType.Generic, RequiresRole = "Manager,Admin")]
    public string? MbReference { get; set; }
    public bool BankTransferEnabled { get; set; }
    public bool MbWayEnabled { get; set; }
    public bool CardEnabled { get; set; }
}

public class UpdatePaymentMethodsRequest
{
    public string? Iban { get; set; }
    public string? Instructions { get; set; }
    public string? MbWay { get; set; }
    public string? MbReference { get; set; }
    public bool BankTransferEnabled { get; set; }
    public bool MbWayEnabled { get; set; }
    public bool CardEnabled { get; set; }
}


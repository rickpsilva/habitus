namespace Habitus.Application.Attributes;

public enum SensitiveDataType
{
    Email,
    Phone,
    TaxId,
    Iban,
    Generic,
}

[AttributeUsage(AttributeTargets.Property)]
public sealed class SensitiveDataAttribute : Attribute
{
    public SensitiveDataAttribute(SensitiveDataType dataType = SensitiveDataType.Generic)
    {
        DataType = dataType;
    }

    public SensitiveDataType DataType { get; }

    // Comma-separated role names that can see unmasked values (e.g. "Manager,Admin").
    public string? RequiresRole { get; init; }
}

using Habitus.Application.Attributes;
using System.Collections;
using System.Reflection;

namespace Habitus.Application.Helpers;

public static class DataMaskingHelper
{
    public static T? ApplySensitiveDataMasking<T>(T? target, string? currentRole)
    {
        if (target == null)
            return target;

        var properties = target.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance);
        foreach (var property in properties)
        {
            if (property.PropertyType != typeof(string) || !property.CanRead || !property.CanWrite)
                continue;

            var attribute = property.GetCustomAttribute<SensitiveDataAttribute>();
            if (attribute == null)
                continue;

            if (RoleCanSeeRawValue(currentRole, attribute.RequiresRole))
                continue;

            var rawValue = property.GetValue(target) as string;
            var maskedValue = attribute.DataType switch
            {
                SensitiveDataType.Email => MaskEmail(rawValue),
                SensitiveDataType.Phone => MaskPhone(rawValue),
                SensitiveDataType.TaxId => MaskTaxId(rawValue),
                SensitiveDataType.Iban => MaskIban(rawValue),
                _ => string.IsNullOrWhiteSpace(rawValue) ? rawValue : "****",
            };

            property.SetValue(target, maskedValue);
        }

        return target;
    }

    public static object? ApplySensitiveDataMaskingRecursively(object? target, string? currentRole)
    {
        var visited = new HashSet<object>(ReferenceEqualityComparer.Instance);
        ApplySensitiveDataMaskingRecursivelyInternal(target, currentRole, visited);
        return target;
    }

    public static string? MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return email;

        var atIndex = email.IndexOf('@');
        if (atIndex <= 0 || atIndex != email.LastIndexOf('@') || atIndex == email.Length - 1)
            return "****";

        var local = email[..atIndex];
        var domain = email[(atIndex + 1)..];

        if (local.Length == 1)
            return $"*@{domain}";

        if (local.Length == 2)
            return $"{local[0]}*@{domain}";

        return $"{local[0]}***@{domain}";
    }

    public static string? MaskPhone(string? phone)
    {
        return MaskWithPredicate(phone, char.IsDigit, keepStart: 0, keepEnd: 2);
    }

    public static string? MaskTaxId(string? taxId)
    {
        return MaskWithPredicate(taxId, char.IsDigit, keepStart: 0, keepEnd: 4);
    }

    public static string? MaskIban(string? iban)
    {
        return MaskWithPredicate(iban, char.IsLetterOrDigit, keepStart: 4, keepEnd: 4);
    }

    private static string? MaskWithPredicate(
        string? value,
        Func<char, bool> candidatePredicate,
        int keepStart,
        int keepEnd)
    {
        if (string.IsNullOrWhiteSpace(value))
            return value;

        var candidateIndexes = new List<int>();
        for (var i = 0; i < value.Length; i++)
        {
            if (candidatePredicate(value[i]))
                candidateIndexes.Add(i);
        }

        if (candidateIndexes.Count <= keepStart + keepEnd)
            return value;

        var keepIndexes = new HashSet<int>();

        for (var i = 0; i < keepStart && i < candidateIndexes.Count; i++)
        {
            keepIndexes.Add(candidateIndexes[i]);
        }

        for (var i = candidateIndexes.Count - keepEnd; i < candidateIndexes.Count; i++)
        {
            if (i >= 0)
                keepIndexes.Add(candidateIndexes[i]);
        }

        var chars = value.ToCharArray();
        foreach (var index in candidateIndexes)
        {
            if (!keepIndexes.Contains(index))
                chars[index] = '*';
        }

        return new string(chars);
    }

    private static bool RoleCanSeeRawValue(string? currentRole, string? requiresRole)
    {
        if (string.IsNullOrWhiteSpace(requiresRole))
            return false;

        if (string.IsNullOrWhiteSpace(currentRole))
            return false;

        var allowedRoles = requiresRole
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

        return allowedRoles.Any(r => string.Equals(r, currentRole, StringComparison.OrdinalIgnoreCase));
    }

    private static void ApplySensitiveDataMaskingRecursivelyInternal(
        object? target,
        string? currentRole,
        HashSet<object> visited)
    {
        if (target == null)
            return;

        var type = target.GetType();
        if (IsSimpleType(type))
            return;

        if (!type.IsValueType)
        {
            if (!visited.Add(target))
                return;
        }

        if (target is IEnumerable enumerable and not string)
        {
            foreach (var item in enumerable)
            {
                ApplySensitiveDataMaskingRecursivelyInternal(item, currentRole, visited);
            }

            return;
        }

        ApplySensitiveDataMasking(target, currentRole);

        var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
        foreach (var property in properties)
        {
            if (!property.CanRead || property.GetIndexParameters().Length > 0)
                continue;

            if (property.PropertyType == typeof(string) || IsSimpleType(property.PropertyType))
                continue;

            object? value;
            try
            {
                value = property.GetValue(target);
            }
            catch
            {
                continue;
            }

            ApplySensitiveDataMaskingRecursivelyInternal(value, currentRole, visited);
        }
    }

    private static bool IsSimpleType(Type type)
    {
        return type.IsPrimitive
            || type.IsEnum
            || type == typeof(string)
            || type == typeof(decimal)
            || type == typeof(DateTime)
            || type == typeof(DateTimeOffset)
            || type == typeof(TimeSpan)
            || type == typeof(Guid);
    }
}

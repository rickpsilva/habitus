using FluentValidation;
using Habitus.Application.DTOs.Billing;

namespace Habitus.Application.Validators.Billing;

public class MarkInvoicePaidRequestValidator : AbstractValidator<MarkInvoicePaidRequest>
{
    public MarkInvoicePaidRequestValidator()
    {
        RuleFor(x => x.PaidDate)
            .Must(date => !date.HasValue || date.Value <= DateTime.UtcNow)
            .WithMessage("Data de pagamento não pode estar no futuro");

        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .WithMessage("Notas não podem ultrapassar 500 caracteres")
            .Matches(@"^[a-zA-Z0-9\s\-.,áéíóúàâêôãõ]*$")
            .When(x => !string.IsNullOrWhiteSpace(x.Notes))
            .WithMessage("Notas contêm caracteres inválidos");
    }
}

public class CancelInvoiceRequestValidator : AbstractValidator<CancelInvoiceRequest>
{
    public CancelInvoiceRequestValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty()
            .WithMessage("Razão de cancelamento é obrigatória")
            .Length(5, 256)
            .WithMessage("Razão deve estar entre 5 e 256 caracteres")
            .Matches(@"^[a-zA-Z0-9\s\-.,áéíóúàâêôãõ]*$")
            .WithMessage("Razão contém caracteres inválidos");

        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .WithMessage("Notas não podem ultrapassar 500 caracteres")
            .Matches(@"^[a-zA-Z0-9\s\-.,áéíóúàâêôãõ]*$")
            .When(x => !string.IsNullOrWhiteSpace(x.Notes))
            .WithMessage("Notas contêm caracteres inválidos");
    }
}

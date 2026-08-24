using FluentValidation;
using Habitus.Application.DTOs.Polls;

namespace Habitus.Application.Validators;

public class CreatePollRequestValidator : AbstractValidator<CreatePollRequest>
{
    public CreatePollRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty()
            .WithMessage("O título é obrigatório.")
            .MaximumLength(200)
            .WithMessage("O título não pode exceder 200 caracteres.");

        RuleFor(x => x.Description)
            .NotEmpty()
            .WithMessage("A descrição é obrigatória.");

        RuleFor(x => x.ExpiresAtUtc)
            .Must(BeFutureDate)
            .WithMessage("A data de expiração deve ser posterior à data atual.");

        RuleFor(x => x.Options)
            .NotNull()
            .WithMessage("As opções são obrigatórias.")
            .Must(HaveAtLeastTwoOptions)
            .WithMessage("A votação deve ter pelo menos duas opções.")
            .Must(HaveDistinctNonEmptyTexts)
            .WithMessage("As opções devem ter texto não vazio e ser distintas.");
    }

    private static bool BeFutureDate(DateTime date) => date > DateTime.UtcNow;

    private static bool HaveAtLeastTwoOptions(List<CreatePollOptionRequest>? options) =>
        options != null && options.Count >= 2;

    private static bool HaveDistinctNonEmptyTexts(List<CreatePollOptionRequest>? options)
    {
        if (options == null) return true;
        return options.All(o => !string.IsNullOrWhiteSpace(o.Text))
            && options.Select(o => o.Text.Trim()).Distinct().Count() == options.Count;
    }
}

public class CastVoteRequestValidator : AbstractValidator<CastVoteRequest>
{
    public CastVoteRequestValidator()
    {
        RuleFor(x => x.PollOptionId)
            .NotEmpty()
            .WithMessage("A opção de voto é obrigatória.");
    }
}

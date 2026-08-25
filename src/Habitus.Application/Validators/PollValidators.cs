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

        RuleFor(x => x.AnnouncementId)
            .NotNull()
            .WithMessage("A votação deve estar associada a um comunicado.");

        RuleFor(x => x.ClosesAtUtc)
            .Must(BeFutureDate)
            .WithMessage("A data de fecho deve ser posterior à data atual.");

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

public class UpdatePollRequestValidator : AbstractValidator<UpdatePollRequest>
{
    public UpdatePollRequestValidator()
    {
        RuleFor(x => x.Title!)
            .NotEmpty()
            .WithMessage("O título é obrigatório.")
            .MaximumLength(200)
            .WithMessage("O título não pode exceder 200 caracteres.")
            .When(x => x.Title != null);

        RuleFor(x => x.Description!)
            .NotEmpty()
            .WithMessage("A descrição é obrigatória.")
            .When(x => x.Description != null);

        RuleFor(x => x.ClosesAtUtc)
            .Must(BeFutureDate)
            .WithMessage("A data de fecho deve ser posterior à data atual.")
            .When(x => x.ClosesAtUtc.HasValue);

        RuleFor(x => x.Options!)
            .Must(HaveAtLeastTwoOptions)
            .WithMessage("A votação deve ter pelo menos duas opções.")
            .Must(HaveDistinctNonEmptyTexts)
            .WithMessage("As opções devem ter texto não vazio e ser distintas.")
            .When(x => x.Options != null);
    }

    private static bool BeFutureDate(DateTime? date) => date.HasValue && date.Value > DateTime.UtcNow;

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

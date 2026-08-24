using FluentValidation;
using Habitus.Application.DTOs.Announcements;

namespace Habitus.Application.Validators;

public class CreateAnnouncementRequestValidator : AbstractValidator<CreateAnnouncementRequest>
{
    public CreateAnnouncementRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty()
            .WithMessage("O título é obrigatório.")
            .MaximumLength(200)
            .WithMessage("O título não pode exceder 200 caracteres.");

        RuleFor(x => x.Content)
            .NotEmpty()
            .WithMessage("O conteúdo é obrigatório.");

        RuleFor(x => x.Category)
            .NotEmpty()
            .WithMessage("A categoria é obrigatória.")
            .Must(BeValidCategory)
            .WithMessage("Categoria inválida.");

        RuleFor(x => x.ValidUntil)
            .Must(BeFutureOrPresentDate)
            .When(x => x.ValidUntil.HasValue)
            .WithMessage("A data de expiração não pode ser anterior à data atual.");
    }

    private static bool BeValidCategory(string category)
    {
        var validCategories = new[] { "Works", "Noise", "Mail", "General", "Urgent", "Event" };
        return validCategories.Contains(category);
    }

    private static bool BeFutureOrPresentDate(DateTime? date)
    {
        if (!date.HasValue) return true;
        return date.Value >= DateTime.UtcNow;
    }
}

public class UpdateAnnouncementRequestValidator : AbstractValidator<UpdateAnnouncementRequest>
{
    public UpdateAnnouncementRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty()
            .WithMessage("O título é obrigatório.")
            .MaximumLength(200)
            .WithMessage("O título não pode exceder 200 caracteres.");

        RuleFor(x => x.Content)
            .NotEmpty()
            .WithMessage("O conteúdo é obrigatório.");

        RuleFor(x => x.Category)
            .NotEmpty()
            .WithMessage("A categoria é obrigatória.")
            .Must(BeValidCategory)
            .WithMessage("Categoria inválida.");

        RuleFor(x => x.ValidUntil)
            .Must(BeFutureOrPresentDate)
            .When(x => x.ValidUntil.HasValue)
            .WithMessage("A data de expiração não pode ser anterior à data atual.");
    }

    private static bool BeValidCategory(string category)
    {
        var validCategories = new[] { "Works", "Noise", "Mail", "General", "Urgent", "Event" };
        return validCategories.Contains(category);
    }

    private static bool BeFutureOrPresentDate(DateTime? date)
    {
        if (!date.HasValue) return true;
        return date.Value >= DateTime.UtcNow;
    }
}
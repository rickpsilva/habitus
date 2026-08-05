using FluentValidation;
using Habitus.Application.DTOs.ExpenseCategory;
using Habitus.Application.Services;

namespace Habitus.Application.Validators;

public class CreateExpenseCategoryRequestValidator : AbstractValidator<CreateExpenseCategoryRequest>
{
    public CreateExpenseCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("O nome da categoria é obrigatório.")
            .Length(2, 120)
            .WithMessage("O nome da categoria deve ter entre 2 e 120 caracteres.");

        RuleFor(x => x.Hashtags)
            .Must(h => h == null || h.Count <= 20)
            .WithMessage("Não é permitido mais de 20 hashtags.");

        RuleForEach(x => x.Hashtags)
            .Must(ExpenseCategoryService.IsValidHashtag)
            .WithMessage("Cada hashtag deve ter no máximo 50 caracteres e apenas conter letras, números, hífen ou underscore.");
    }
}

public class UpdateExpenseCategoryRequestValidator : AbstractValidator<UpdateExpenseCategoryRequest>
{
    public UpdateExpenseCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("O nome da categoria é obrigatório.")
            .Length(2, 120)
            .WithMessage("O nome da categoria deve ter entre 2 e 120 caracteres.");

        RuleFor(x => x.Hashtags)
            .Must(h => h == null || h.Count <= 20)
            .WithMessage("Não é permitido mais de 20 hashtags.");

        RuleForEach(x => x.Hashtags)
            .Must(ExpenseCategoryService.IsValidHashtag)
            .WithMessage("Cada hashtag deve ter no máximo 50 caracteres e apenas conter letras, números, hífen ou underscore.");
    }
}

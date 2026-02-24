using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Infrastructure.Data;
using Habitus.Infrastructure.Repositories;
using Habitus.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Habitus.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<HabitusDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

        services.AddScoped<IBlobStorageService, AzureBlobStorageService>();
        services.AddScoped<IEmailService, AzureCommunicationEmailService>();
        services.AddScoped<ITranslationService, AzureTranslationService>();

        services.AddScoped<AuthService>();
        services.AddScoped<ResidentService>();
        services.AddScoped<MaintenanceService>();
        services.AddScoped<ReservationService>();
        services.AddScoped<FinancialService>();

        return services;
    }
}

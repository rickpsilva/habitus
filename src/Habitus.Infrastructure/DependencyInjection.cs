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
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration, bool isDevelopment = false)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                "Connection string 'DefaultConnection' is not configured. " +
                "Please ensure it is set in appsettings.json or environment variables."
            );
        }

        services.AddDbContext<HabitusDbContext>(options =>
            options.UseNpgsql(connectionString, 
                b => b.MigrationsAssembly("Habitus.Infrastructure")));

        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

        // Use mock services in development or if Azure is not configured
        var azureConnectionString = configuration["AzureCommunication:ConnectionString"];
        var azureStorageConnectionString = configuration["AzureStorage:ConnectionString"];
        var azureTranslationKey = configuration["AzureTranslation:Key"];

        if (isDevelopment || string.IsNullOrEmpty(azureStorageConnectionString))
        {
            services.AddScoped<IBlobStorageService, LocalFileStorageService>();
        }
        else
        {
            services.AddScoped<IBlobStorageService, AzureBlobStorageService>();
        }

        var emailProvider = configuration["Email:Provider"]?.Trim().ToLowerInvariant();
        switch (emailProvider)
        {
            case "mock":
                services.AddScoped<IEmailService, MockEmailService>();
                break;
            case "azure":
                services.AddScoped<IEmailService, AzureCommunicationEmailService>();
                break;
            case "smtp":
                services.AddScoped<IEmailService, SmtpCommunicationEmailService>();
                break;
            default:
                if (isDevelopment && string.IsNullOrEmpty(azureConnectionString))
                {
                    services.AddScoped<IEmailService, MockEmailService>();
                }
                else if (!string.IsNullOrEmpty(azureConnectionString))
                {
                    services.AddScoped<IEmailService, AzureCommunicationEmailService>();
                }
                else
                {
                    services.AddScoped<IEmailService, SmtpCommunicationEmailService>();
                }
                break;
        }

        services.AddScoped<IWhatsAppService, MockWhatsAppService>();

        if (isDevelopment || string.IsNullOrEmpty(azureTranslationKey))
        {
            services.AddScoped<ITranslationService, MockTranslationService>();
        }
        else
        {
            services.AddScoped<ITranslationService, AzureTranslationService>();
        }

        // Payment gateway: use Stripe in production when keys are configured
        var stripeSecretKey = configuration["Stripe:SecretKey"];
        if (isDevelopment || string.IsNullOrEmpty(stripeSecretKey))
        {
            services.AddScoped<IPaymentGatewayService, MockPaymentGatewayService>();
        }
        else
        {
            services.AddScoped<IPaymentGatewayService, StripePaymentGatewayService>();
        }

        services.AddScoped<AuthService>();
        services.AddScoped<ResidentService>();
        services.AddScoped<MaintenanceService>();
        services.AddScoped<ReservationService>();
        services.AddScoped<FinancialService>();
        services.AddScoped<ReserveFundService>();
        services.AddScoped<AssemblyService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<INotificationDispatchService, NotificationDispatchService>();
        services.AddScoped<PaymentService>();
        services.AddScoped<PaymentSettingsService>();
        services.AddScoped<UsefulContactService>();
        services.AddScoped<SupplierService>();
        services.AddScoped<ReceiptService>();
        services.AddScoped<ReceiptTemplateSettingsService>();
        
        // New multi-condominium services
        services.AddScoped<UserService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<CondominiumService>();
        services.AddScoped<SubscriptionService>();
        services.AddScoped<InvoiceService>();
        services.AddScoped<InvoicePdfService>();
        services.AddScoped<SaftXmlService>();
        services.AddScoped<HistoricalEncryptionBackfillService>();
        services.AddScoped<RgpdMigrationOperationsService>();

        // Background services for daily tasks
        services.AddHostedService<InitialManagerBootstrapHostedService>();
        services.AddHostedService<InvoiceGenerationBackgroundService>();
        services.AddHostedService<HistoricalEncryptionBackfillHostedService>();

        // Encryption service for sensitive data
        services.AddScoped<IEncryptionService, EncryptionService>();

        return services;
    }
}

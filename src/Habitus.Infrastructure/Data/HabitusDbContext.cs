using Habitus.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Habitus.Infrastructure.Data;

public class HabitusDbContext : DbContext
{
    public HabitusDbContext(DbContextOptions<HabitusDbContext> options) : base(options) { }

    // New multi-condominium architecture
    public DbSet<Condominium> Condominiums => Set<Condominium>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserCondominium> UserCondominiums => Set<UserCondominium>();
    public DbSet<UserAuthProvider> UserAuthProviders => Set<UserAuthProvider>();
    public DbSet<UserRecoveryCode> UserRecoveryCodes => Set<UserRecoveryCode>();
    public DbSet<AuthChallenge> AuthChallenges => Set<AuthChallenge>();
    
    // Existing entities (updated to use Condominium)
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<MaintenanceRequest> MaintenanceRequests => Set<MaintenanceRequest>();
    public DbSet<MaintenanceConfirmation> MaintenanceConfirmations => Set<MaintenanceConfirmation>();
    public DbSet<Intervention> Interventions => Set<Intervention>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<FinancialRecord> FinancialRecords => Set<FinancialRecord>();
    public DbSet<ReserveFund> ReserveFunds => Set<ReserveFund>();
    public DbSet<Assembly> Assemblies => Set<Assembly>();
    public DbSet<AssemblyAttendance> AssemblyAttendances => Set<AssemblyAttendance>();
    public DbSet<AssemblyDecision> AssemblyDecisions => Set<AssemblyDecision>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<SharedSpace> SharedSpaces => Set<SharedSpace>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<UsefulContact> UsefulContacts => Set<UsefulContact>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PaymentSettings> PaymentSettings => Set<PaymentSettings>();
    public DbSet<ReceiptTemplateSettings> ReceiptTemplateSettings => Set<ReceiptTemplateSettings>();
    public DbSet<CommunicationSettings> CommunicationSettings => Set<CommunicationSettings>();
    public DbSet<QuotaPlan> QuotaPlans => Set<QuotaPlan>();
    public DbSet<QuotaCalculation> QuotaCalculations => Set<QuotaCalculation>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<PlanFeature> PlanFeatures => Set<PlanFeature>();
    public DbSet<CondominiumSubscription> CondominiumSubscriptions => Set<CondominiumSubscription>();
    public DbSet<AnnouncementAttachment> AnnouncementAttachments => Set<AnnouncementAttachment>();
    public DbSet<AnnouncementComment> AnnouncementComments => Set<AnnouncementComment>();
    public DbSet<AnnouncementReadStatus> AnnouncementReadStatuses => Set<AnnouncementReadStatus>();
    public DbSet<NotificationDispatchDelivery> NotificationDispatchDeliveries => Set<NotificationDispatchDelivery>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<PlatformBillingSettings> PlatformBillingSettings => Set<PlatformBillingSettings>();
    public DbSet<PlatformUploadSettings> PlatformUploadSettings => Set<PlatformUploadSettings>();
    public DbSet<SystemEmailSettings> SystemEmailSettings => Set<SystemEmailSettings>();
    
    // Deprecated entities (kept for migration compatibility)
    [Obsolete("Use Users instead")]
    public DbSet<Resident> Residents => Set<Resident>();
    [Obsolete("Use Condominiums instead")]
    public DbSet<Building> Buildings => Set<Building>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure User entity
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.EmailHash).IsUnique();
            entity.Property(u => u.Email).IsRequired();
            entity.Property(u => u.EmailEncrypted).HasMaxLength(2048);
            entity.Property(u => u.EmailHash).HasMaxLength(64);
            entity.Property(u => u.Name).IsRequired();
            entity.Property(u => u.PasswordHash).IsRequired();
            entity.Property(u => u.PhoneEncrypted).HasMaxLength(2048);
            entity.Property(u => u.TwoFactorSecretEncrypted).HasMaxLength(2048);
            
            entity.HasOne(u => u.Condominium)
                .WithMany(c => c.Users)
                .HasForeignKey(u => u.CondominiumId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(u => u.Unit)
                .WithMany(un => un.Users)
                .HasForeignKey(u => u.UnitId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<UserAuthProvider>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.ProviderUserId).IsRequired().HasMaxLength(255);
            entity.Property(p => p.ProviderEmail).HasMaxLength(255);
            entity.HasIndex(p => new { p.ProviderType, p.ProviderUserId }).IsUnique();
            entity.HasIndex(p => p.UserId);

            entity.HasOne(p => p.User)
                .WithMany(u => u.AuthProviders)
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserRecoveryCode>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.CodeHash).IsRequired().HasMaxLength(255);
            entity.HasIndex(r => r.UserId);

            entity.HasOne(r => r.User)
                .WithMany(u => u.RecoveryCodes)
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuthChallenge>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.UserAgent).HasMaxLength(1024);
            entity.Property(c => c.IpAddress).HasMaxLength(64);
            entity.HasIndex(c => c.UserId);
            entity.HasIndex(c => c.ExpiresAt);

            entity.HasOne(c => c.User)
                .WithMany(u => u.AuthChallenges)
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure Condominium entity
        modelBuilder.Entity<Condominium>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Name).IsRequired();
            entity.Property(c => c.Address).IsRequired();
            entity.Property(c => c.AddressEncrypted).HasMaxLength(1024);
            entity.Property(c => c.EmailEncrypted).HasMaxLength(2048);
            entity.Property(c => c.PostalCodeEncrypted).HasMaxLength(255);
            entity.Property(c => c.LocalityEncrypted).HasMaxLength(255);
            entity.Property(c => c.ContactPhoneEncrypted).HasMaxLength(255);
        });

        // Configure UserCondominium (many-to-many)
        modelBuilder.Entity<UserCondominium>(entity =>
        {
            entity.HasKey(uc => new { uc.UserId, uc.CondominiumId });
            
            entity.HasOne(uc => uc.User)
                .WithMany(u => u.UserCondominiums)
                .HasForeignKey(uc => uc.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(uc => uc.Condominium)
                .WithMany(c => c.UserCondominiums)
                .HasForeignKey(uc => uc.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure Unit relationships
        modelBuilder.Entity<Unit>(entity =>
        {
            entity.HasOne(u => u.Condominium)
                .WithMany(c => c.Units)
                .HasForeignKey(u => u.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure MaintenanceRequest relationships
        modelBuilder.Entity<MaintenanceRequest>(entity =>
        {
            entity.HasOne(m => m.Condominium)
                .WithMany()
                .HasForeignKey(m => m.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
            
            // Note: Unit relationship is configured by convention (UnitId + Unit navigation property)
            
            // Photos property configuration
            var photosComparer = new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<string>>(
                (c1, c2) => (c1 == null && c2 == null) || (c1 != null && c2 != null && c1.SequenceEqual(c2)),
                c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                c => c.ToList());

            entity.Property(m => m.Photos)
                .HasConversion(
                    v => string.Join(',', v),
                    v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList())
                .Metadata.SetValueComparer(photosComparer);
        });

        // Configure Reservation relationships
        modelBuilder.Entity<Reservation>(entity =>
        {
            entity.HasOne(r => r.Condominium)
                .WithMany()
                .HasForeignKey(r => r.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(r => r.Space)
                .WithMany()
                .HasForeignKey(r => r.SpaceId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure Document relationships and column mapping
        modelBuilder.Entity<Document>(entity =>
        {
            entity.HasKey(d => d.Id);
            
            entity.HasOne(d => d.UploadedByUser)
                .WithMany()
                .HasForeignKey(d => d.UploadedByUserId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(d => d.Condominium)
                .WithMany(c => c.Documents)
                .HasForeignKey(d => d.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(d => d.Unit)
                .WithMany(u => u.Documents)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(d => d.Assembly)
                .WithMany(a => a.Documents)
                .HasForeignKey(d => d.AssemblyId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(d => d.MaintenanceRequest)
                .WithMany(m => m.Documents)
                .HasForeignKey(d => d.MaintenanceRequestId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Configure Payment relationships
        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Amount).HasColumnType("decimal(18,2)");
            entity.Property(p => p.Description).IsRequired();
            
            entity.HasOne(p => p.Resident)
                .WithMany()
                .HasForeignKey(p => p.ResidentId)
                .OnDelete(DeleteBehavior.Restrict);
            
            entity.HasOne(p => p.Unit)
                .WithMany()
                .HasForeignKey(p => p.UnitId)
                .OnDelete(DeleteBehavior.Restrict);
            
            entity.HasOne(p => p.Condominium)
                .WithMany(c => c.Payments)
                .HasForeignKey(p => p.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(p => p.ProcessedByUser)
                .WithMany()
                .HasForeignKey(p => p.ProcessedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(p => p.FinancialRecord)
                .WithMany()
                .HasForeignKey(p => p.FinancialRecordId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(p => p.Reservation)
                .WithMany()
                .HasForeignKey(p => p.ReservationId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Configure Notification relationships
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(n => n.Id);
            
            entity.HasOne(n => n.Condominium)
                .WithMany(c => c.Notifications)
                .HasForeignKey(n => n.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(n => n.TargetUser)
                .WithMany()
                .HasForeignKey(n => n.TargetUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<NotificationDispatchDelivery>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.Property(d => d.Channel).HasMaxLength(32).IsRequired();
            entity.Property(d => d.DispatchKey).HasMaxLength(128).IsRequired();
            entity.Property(d => d.RecipientExternalId).HasMaxLength(256);
            entity.Property(d => d.Status).HasMaxLength(32).IsRequired();
            entity.Property(d => d.LastError).HasMaxLength(2000);
            
            // Foreign key to User for email channel deliveries
            entity.HasOne(d => d.RecipientUser)
                .WithMany()
                .HasForeignKey(d => d.RecipientUserId)
                .OnDelete(DeleteBehavior.Cascade);
            
            // Unique constraint: Channel + DispatchKey + (RecipientUserId or RecipientExternalId)
            // This ensures no duplicate deliveries for the same dispatch to the same recipient
            entity.HasIndex(d => new { d.Channel, d.DispatchKey, d.RecipientUserId, d.RecipientExternalId })
                .IsUnique()
                .HasName("IX_NotificationDispatchDelivery_Unique_Delivery");
            
            entity.HasIndex(d => d.CondominiumId);
        });

        // Configure PaymentSettings relationships
        modelBuilder.Entity<PaymentSettings>(entity =>
        {
            entity.HasKey(p => p.Id);
            
            entity.HasOne(p => p.Condominium)
                .WithMany()
                .HasForeignKey(p => p.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasIndex(p => p.CondominiumId);
        });

        modelBuilder.Entity<PlatformBillingSettings>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.GatewayProvider).IsRequired();
        });

        modelBuilder.Entity<PlatformUploadSettings>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.MaxUploadSizeBytes).IsRequired();
        });

        // Configure CommunicationSettings relationships
        modelBuilder.Entity<CommunicationSettings>(entity =>
        {
            entity.HasKey(c => c.Id);
            
            entity.HasOne(c => c.Condominium)
                .WithMany()
                .HasForeignKey(c => c.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasIndex(c => c.CondominiumId);
        });

        // Configure QuotaPlan relationships
        modelBuilder.Entity<QuotaPlan>(entity =>
        {
            entity.HasKey(q => q.Id);
            
            entity.HasOne(q => q.Condominium)
                .WithMany()
                .HasForeignKey(q => q.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasIndex(q => new { q.CondominiumId, q.Year });
            entity.HasIndex(q => q.Status);
        });

        // Configure QuotaCalculation relationships
        modelBuilder.Entity<QuotaCalculation>(entity =>
        {
            entity.HasKey(q => q.Id);
            
            entity.HasOne(q => q.QuotaPlan)
                .WithMany(p => p.Calculations)
                .HasForeignKey(q => q.QuotaPlanId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(q => q.Unit)
                .WithMany()
                .HasForeignKey(q => q.UnitId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasIndex(q => q.QuotaPlanId);
            entity.HasIndex(q => q.UnitId);
        });

        // ── Subscription Plans ────────────────────────────────────────────────
        var freePlanId        = new Guid("a0b0c001-0000-0000-0000-000000000000");
        var silverPlanId      = new Guid("a0b0c002-0000-0000-0000-000000000000");
        var goldPlanId        = new Guid("a0b0c003-0000-0000-0000-000000000000");

        modelBuilder.Entity<SubscriptionPlan>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Name).IsRequired().HasMaxLength(64);
            entity.Property(p => p.Description).HasMaxLength(512);
            entity.Property(p => p.PriceMonthly).HasColumnType("decimal(18,2)");
            entity.Property(p => p.AnnualDiscountPercent).HasColumnType("decimal(5,2)");
            entity.Property(p => p.QuinquennialDiscountPercent).HasColumnType("decimal(5,2)");
            entity.Property(p => p.PriceAnnual).HasColumnType("decimal(18,2)");
            entity.Property(p => p.PriceQuinquennial).HasColumnType("decimal(18,2)");
            entity.HasIndex(p => p.Tier);

            entity.HasData(
                new SubscriptionPlan { Id = freePlanId,   Name = "Free",   Tier = PlanTier.Free,   Description = "Base operacional com features essenciais.",                                 PriceMonthly = 0m,     AnnualDiscountPercent = 0m,  QuinquennialDiscountPercent = 0m,  PriceAnnual = 0m,      PriceQuinquennial = 0m,      IsActive = true },
                new SubscriptionPlan { Id = silverPlanId, Name = "Silver", Tier = PlanTier.Silver, Description = "Automações e módulos avançados para condomínios em crescimento.",     PriceMonthly = 29.90m, AnnualDiscountPercent = 17m, QuinquennialDiscountPercent = 30m, PriceAnnual = 299.00m, PriceQuinquennial = 1299.00m, IsActive = true },
                new SubscriptionPlan { Id = goldPlanId,   Name = "Gold",   Tier = PlanTier.Gold,   Description = "Controlo total: analytics, WhatsApp e acesso à API REST.", PriceMonthly = 59.90m, AnnualDiscountPercent = 17m, QuinquennialDiscountPercent = 30m, PriceAnnual = 599.00m, PriceQuinquennial = 2499.00m, IsActive = true }
            );
        });

        // ── Plan Features ─────────────────────────────────────────────────────
        modelBuilder.Entity<PlanFeature>(entity =>
        {
            entity.HasKey(f => f.Id);
            entity.Property(f => f.FeatureKey).IsRequired().HasMaxLength(64);
            entity.Property(f => f.FeatureLabel).IsRequired().HasMaxLength(128);
            entity.HasIndex(f => new { f.PlanId, f.FeatureKey }).IsUnique();

            entity.HasOne(f => f.Plan)
                .WithMany(p => p.Features)
                .HasForeignKey(f => f.PlanId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasData(
                // Free
                new PlanFeature { Id = new Guid("f1000001-0000-0000-0000-000000000000"), PlanId = freePlanId,   FeatureKey = "maintenance",            FeatureLabel = "Manutenção",                IsEnabled = true },
                new PlanFeature { Id = new Guid("f1000002-0000-0000-0000-000000000000"), PlanId = freePlanId,   FeatureKey = "announcements",          FeatureLabel = "Comunicados",               IsEnabled = true },
                new PlanFeature { Id = new Guid("f1000003-0000-0000-0000-000000000000"), PlanId = freePlanId,   FeatureKey = "documents",              FeatureLabel = "Documentos (até 10)",       IsEnabled = true },
                // Silver
                new PlanFeature { Id = new Guid("f2000001-0000-0000-0000-000000000000"), PlanId = silverPlanId, FeatureKey = "maintenance",            FeatureLabel = "Manutenção",                IsEnabled = true },
                new PlanFeature { Id = new Guid("f2000002-0000-0000-0000-000000000000"), PlanId = silverPlanId, FeatureKey = "announcements",          FeatureLabel = "Comunicados",               IsEnabled = true },
                new PlanFeature { Id = new Guid("f2000003-0000-0000-0000-000000000000"), PlanId = silverPlanId, FeatureKey = "documents",              FeatureLabel = "Documentos (ilimitados)",   IsEnabled = true },
                new PlanFeature { Id = new Guid("f2000004-0000-0000-0000-000000000000"), PlanId = silverPlanId, FeatureKey = "reservations",           FeatureLabel = "Reservas de Espaços",       IsEnabled = true },
                new PlanFeature { Id = new Guid("f2000005-0000-0000-0000-000000000000"), PlanId = silverPlanId, FeatureKey = "financial",              FeatureLabel = "Gestão Financeira",         IsEnabled = true },
                new PlanFeature { Id = new Guid("f2000006-0000-0000-0000-000000000000"), PlanId = silverPlanId, FeatureKey = "assemblies",             FeatureLabel = "Assembleias",               IsEnabled = true },
                new PlanFeature { Id = new Guid("f2000007-0000-0000-0000-000000000000"), PlanId = silverPlanId, FeatureKey = "email_notifications",    FeatureLabel = "Notificações por Email",    IsEnabled = true },
                // Gold
                new PlanFeature { Id = new Guid("f3000001-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "maintenance",            FeatureLabel = "Manutenção",                IsEnabled = true },
                new PlanFeature { Id = new Guid("f3000002-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "announcements",          FeatureLabel = "Comunicados",               IsEnabled = true },
                new PlanFeature { Id = new Guid("f3000003-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "documents",              FeatureLabel = "Documentos (ilimitados)",   IsEnabled = true },
                new PlanFeature { Id = new Guid("f3000004-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "reservations",           FeatureLabel = "Reservas de Espaços",       IsEnabled = true },
                new PlanFeature { Id = new Guid("f3000005-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "financial",              FeatureLabel = "Gestão Financeira",         IsEnabled = true },
                new PlanFeature { Id = new Guid("f3000006-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "assemblies",             FeatureLabel = "Assembleias",               IsEnabled = true },
                new PlanFeature { Id = new Guid("f3000007-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "email_notifications",    FeatureLabel = "Notificações por Email",    IsEnabled = true },
                new PlanFeature { Id = new Guid("f3000008-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "analytics",              FeatureLabel = "Analytics Avançado",        IsEnabled = true },
                new PlanFeature { Id = new Guid("f3000009-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "whatsapp_notifications", FeatureLabel = "Notificações WhatsApp",     IsEnabled = true },
                new PlanFeature { Id = new Guid("f3000010-0000-0000-0000-000000000000"), PlanId = goldPlanId,   FeatureKey = "api_access",             FeatureLabel = "Acesso à API REST",         IsEnabled = true }
            );
        });

        // ── Condominium Subscriptions ─────────────────────────────────────────
        modelBuilder.Entity<CondominiumSubscription>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.PriceAtPurchase).HasColumnType("decimal(18,2)");
            entity.HasIndex(s => s.CondominiumId);
            entity.HasIndex(s => s.Status);

            entity.HasOne(s => s.Condominium)
                .WithMany()
                .HasForeignKey(s => s.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.Plan)
                .WithMany(p => p.Subscriptions)
                .HasForeignKey(s => s.PlanId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Invoices (SAF-T Compatible) ───────────────────────────────────────
        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.Property(i => i.Number).IsRequired();
            entity.Property(i => i.Series).IsRequired().HasMaxLength(8);
            entity.Property(i => i.Year).IsRequired();
            entity.Property(i => i.Type).IsRequired();
            entity.Property(i => i.CustomerName).IsRequired().HasMaxLength(256);
            entity.Property(i => i.CustomerTaxIdEncrypted).HasMaxLength(255); // Encrypted NIF
            entity.Property(i => i.CustomerAddress).HasMaxLength(512);
            entity.Property(i => i.PlanName).IsRequired().HasMaxLength(128);
            entity.Property(i => i.SubtotalAmount).HasColumnType("decimal(18,2)");
            entity.Property(i => i.VatAmount).HasColumnType("decimal(18,2)");
            entity.Property(i => i.TotalAmount).HasColumnType("decimal(18,2)");
            entity.Property(i => i.VatRate).HasColumnType("decimal(5,2)");

            // Relationships
            entity.HasOne(i => i.Condominium)
                .WithMany(c => c.Invoices)
                .HasForeignKey(i => i.CondominiumId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(i => i.Subscription)
                .WithMany(s => s.Invoices)
                .HasForeignKey(i => i.SubscriptionId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(i => i.IssuedByUser)
                .WithMany()
                .HasForeignKey(i => i.IssuedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(i => i.Document)
                .WithMany()
                .HasForeignKey(i => i.DocumentId)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes for performance (SAF-T reporting queries)
            entity.HasIndex(i => new { i.CondominiumId, i.Year, i.Number })
                .IsUnique()
                .HasDatabaseName("IX_Invoice_Unique_CondominiumYear");
            
            entity.HasIndex(i => new { i.CondominiumId, i.IssuedDate })
                .HasDatabaseName("IX_Invoice_CondominiumIssued");
            
            entity.HasIndex(i => i.Status)
                .HasDatabaseName("IX_Invoice_Status");
            
            entity.HasIndex(i => i.DueDate)
                .HasDatabaseName("IX_Invoice_DueDate");
            
            entity.HasIndex(i => new { i.CondominiumId, i.Status })
                .HasDatabaseName("IX_Invoice_CondominiumStatus");
        });
    }
}

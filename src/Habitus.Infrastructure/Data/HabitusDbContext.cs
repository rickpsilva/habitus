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
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Email).IsRequired();
            entity.Property(u => u.Name).IsRequired();
            entity.Property(u => u.PasswordHash).IsRequired();
            
            entity.HasOne(u => u.Condominium)
                .WithMany(c => c.Users)
                .HasForeignKey(u => u.CondominiumId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(u => u.Unit)
                .WithMany(un => un.Users)
                .HasForeignKey(u => u.UnitId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Configure Condominium entity
        modelBuilder.Entity<Condominium>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Name).IsRequired();
            entity.Property(c => c.Address).IsRequired();
            entity.HasIndex(c => c.TaxId);
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
    }
}

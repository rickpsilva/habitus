using Habitus.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Habitus.Infrastructure.Data;

public class HabitusDbContext : DbContext
{
    public HabitusDbContext(DbContextOptions<HabitusDbContext> options) : base(options) { }

    public DbSet<Building> Buildings => Set<Building>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Resident> Residents => Set<Resident>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<MaintenanceRequest> MaintenanceRequests => Set<MaintenanceRequest>();
    public DbSet<MaintenanceConfirmation> MaintenanceConfirmations => Set<MaintenanceConfirmation>();
    public DbSet<Intervention> Interventions => Set<Intervention>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<FinancialRecord> FinancialRecords => Set<FinancialRecord>();
    public DbSet<Assembly> Assemblies => Set<Assembly>();
    public DbSet<AssemblyAttendance> AssemblyAttendances => Set<AssemblyAttendance>();
    public DbSet<AssemblyDecision> AssemblyDecisions => Set<AssemblyDecision>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<SharedSpace> SharedSpaces => Set<SharedSpace>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<UsefulContact> UsefulContacts => Set<UsefulContact>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<MaintenanceRequest>()
            .Property(m => m.Photos)
            .HasConversion(
                v => string.Join(',', v),
                v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList());
    }
}

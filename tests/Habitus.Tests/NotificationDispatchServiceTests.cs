using System.Linq.Expressions;
using Habitus.Application.Interfaces;
using Habitus.Application.Services;
using Habitus.Domain.Entities;
using Moq;

namespace Habitus.Tests;

public class NotificationDispatchServiceTests
{
    private readonly Mock<IRepository<User>> _userRepositoryMock = new();
    private readonly Mock<IRepository<Condominium>> _condominiumRepositoryMock = new();
    private readonly Mock<IRepository<CommunicationSettings>> _settingsRepositoryMock = new();
    private readonly Mock<IRepository<NotificationDispatchDelivery>> _deliveryRepositoryMock = new();
    private readonly Mock<IEmailService> _emailServiceMock = new();
    private readonly Mock<IWhatsAppService> _whatsAppServiceMock = new();

    [Fact]
    public async Task DispatchAsync_TargetRoleAdmin_SendsEmailToCondominiumWithCommunicationSettings()
    {
        var condominiumId = Guid.NewGuid();
        var condominium = new Condominium
        {
            Id = condominiumId,
            Name = "Condo One",
            Email = "admin-condo@habitus.test"
        };

        SetupCommonRepositories(condominiumId, condominium, activeUsers: Array.Empty<User>());

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            TargetRole = UserRole.Admin.ToString(),
            Title = "Reserva pendente",
            Message = "Existe uma reserva para validar."
        };

        var service = CreateService();

        await service.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        _emailServiceMock.Verify(s => s.SendAsync(
            "admin-condo@habitus.test",
            "Reserva pendente",
            It.Is<string>(body => body.Contains("Existe uma reserva para validar.")),
            EmailSenderType.Condominium,
            condominiumId), Times.Once);
    }

    [Fact]
    public async Task DispatchAsync_TargetResidentWithTargetUserId_SendsEmailToTargetResident()
    {
        var condominiumId = Guid.NewGuid();
        var targetResidentId = Guid.NewGuid();

        var condominium = new Condominium
        {
            Id = condominiumId,
            Name = "Condo Two",
            Email = "condo@habitus.test"
        };

        var resident = new User
        {
            Id = targetResidentId,
            CondominiumId = condominiumId,
            Role = UserRole.Resident,
            IsActive = true,
            Email = "resident@habitus.test"
        };

        SetupCommonRepositories(condominiumId, condominium, new[] { resident });

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            TargetRole = UserRole.Resident.ToString(),
            TargetUserId = targetResidentId,
            Title = "Pagamento confirmado",
            Message = "O seu pagamento foi confirmado."
        };

        var service = CreateService();

        await service.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        _emailServiceMock.Verify(s => s.SendAsync(
            "resident@habitus.test",
            "Pagamento confirmado",
            It.Is<string>(body => body.Contains("O seu pagamento foi confirmado.")),
            EmailSenderType.Condominium,
            condominiumId), Times.Once);
    }

    [Fact]
    public async Task DispatchAsync_TargetUserNotResident_DoesNotSendEmail()
    {
        var condominiumId = Guid.NewGuid();
        var targetAdminId = Guid.NewGuid();

        var condominium = new Condominium
        {
            Id = condominiumId,
            Name = "Condo Three",
            Email = "condo@habitus.test"
        };

        var adminUser = new User
        {
            Id = targetAdminId,
            CondominiumId = condominiumId,
            Role = UserRole.Admin,
            IsActive = true,
            Email = "admin@habitus.test"
        };

        SetupCommonRepositories(condominiumId, condominium, new[] { adminUser });

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            TargetRole = UserRole.Resident.ToString(),
            TargetUserId = targetAdminId,
            Title = "Aviso",
            Message = "Nao deve enviar email para admin neste caso."
        };

        var service = CreateService();

        await service.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        _emailServiceMock.Verify(s => s.SendAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<EmailSenderType>(),
            It.IsAny<Guid?>()), Times.Never);
    }

    [Fact]
    public async Task DispatchAsync_TargetResidentFromDifferentCondominium_DoesNotSendEmail()
    {
        var condominiumId = Guid.NewGuid();
        var otherCondominiumId = Guid.NewGuid();
        var targetResidentId = Guid.NewGuid();

        var condominium = new Condominium
        {
            Id = condominiumId,
            Name = "Condo Isolation",
            Email = "condo@habitus.test"
        };

        var residentFromOtherCondominium = new User
        {
            Id = targetResidentId,
            CondominiumId = otherCondominiumId,
            Role = UserRole.Resident,
            IsActive = true,
            Email = "other-resident@habitus.test"
        };

        SetupCommonRepositories(condominiumId, condominium, new[] { residentFromOtherCondominium });

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            TargetRole = UserRole.Resident.ToString(),
            TargetUserId = targetResidentId,
            Title = "Teste de isolamento",
            Message = "Nao deve ser enviada para outro condominio"
        };

        var service = CreateService();

        await service.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        _emailServiceMock.Verify(s => s.SendAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<EmailSenderType>(),
            It.IsAny<Guid?>()), Times.Never);
    }

    [Fact]
    public async Task DispatchAsync_WithoutTargetRoleAndTargetUserId_SendsEmailToAllCondominiumUsersExceptManagers()
    {
        var condominiumId = Guid.NewGuid();

        var condominium = new Condominium
        {
            Id = condominiumId,
            Name = "Condo Four",
            Email = "condo@habitus.test"
        };

        var admin = new User
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Role = UserRole.Admin,
            IsActive = true,
            Email = "admin@habitus.test"
        };

        var resident = new User
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Role = UserRole.Resident,
            IsActive = true,
            Email = "resident@habitus.test"
        };

        var manager = new User
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            Role = UserRole.Manager,
            IsActive = true,
            Email = "manager@habitus.test"
        };

        SetupCommonRepositories(condominiumId, condominium, new[] { admin, resident, manager });

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            TargetRole = string.Empty,
            TargetUserId = null,
            Title = "Comunicado geral",
            Message = "Mensagem para todos do condominio"
        };

        var service = CreateService();

        await service.DispatchAsync(new[] { notification }, sendExternalChannels: true);

        _emailServiceMock.Verify(s => s.SendAsync(
            "admin@habitus.test",
            "Comunicado geral",
            It.IsAny<string>(),
            EmailSenderType.Condominium,
            condominiumId), Times.Once);

        _emailServiceMock.Verify(s => s.SendAsync(
            "resident@habitus.test",
            "Comunicado geral",
            It.IsAny<string>(),
            EmailSenderType.Condominium,
            condominiumId), Times.Once);

        _emailServiceMock.Verify(s => s.SendAsync(
            "manager@habitus.test",
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<EmailSenderType>(),
            It.IsAny<Guid?>()), Times.Never);
    }

    private NotificationDispatchService CreateService()
    {
        return new NotificationDispatchService(
            _userRepositoryMock.Object,
            _condominiumRepositoryMock.Object,
            _settingsRepositoryMock.Object,
            _deliveryRepositoryMock.Object,
            _emailServiceMock.Object,
            _whatsAppServiceMock.Object);
    }

    private void SetupCommonRepositories(Guid condominiumId, Condominium condominium, IEnumerable<User> activeUsers)
    {
        var deliveries = new List<NotificationDispatchDelivery>();
        var settings = new CommunicationSettings
        {
            Id = Guid.NewGuid(),
            CondominiumId = condominiumId,
            EmailEnabled = true,
            WhatsAppEnabled = false
        };

        _condominiumRepositoryMock
            .Setup(r => r.GetByIdAsync(condominiumId))
            .ReturnsAsync(condominium);

        _settingsRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<CommunicationSettings, bool>>>() ))
            .ReturnsAsync((Expression<Func<CommunicationSettings, bool>> predicate) =>
                new[] { settings }.Where(predicate.Compile()));

        _userRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<User, bool>>>() ))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) =>
                activeUsers.Where(predicate.Compile()));

        _deliveryRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<NotificationDispatchDelivery, bool>>>() ))
            .ReturnsAsync((Expression<Func<NotificationDispatchDelivery, bool>> predicate) =>
                deliveries.Where(predicate.Compile()));

        _deliveryRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<NotificationDispatchDelivery>()))
            .Returns((NotificationDispatchDelivery delivery) =>
            {
                deliveries.Add(delivery);
                return Task.CompletedTask;
            });

        _deliveryRepositoryMock
            .Setup(r => r.Update(It.IsAny<NotificationDispatchDelivery>()));

        _deliveryRepositoryMock
            .Setup(r => r.SaveChangesAsync())
            .ReturnsAsync(1);
    }
}

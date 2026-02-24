namespace Habitus.Domain.Entities;

public enum DocumentType { Insurance, Receipt, MeetingMinutes, Other }

public class Document
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DocumentType Type { get; set; }
    public string Url { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public Guid UploadedBy { get; set; }
    public Guid BuildingId { get; set; }
    public Building Building { get; set; } = null!;
}

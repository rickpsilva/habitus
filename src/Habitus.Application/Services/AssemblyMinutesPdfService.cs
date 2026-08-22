using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using HtmlAgilityPack;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Habitus.Application.Services;

/// <summary>
/// Generates a downloadable PDF for completed assembly minutes (ATA).
/// </summary>
public class AssemblyMinutesPdfService
{
    private readonly IRepository<Assembly> _assemblyRepository;
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IEncryptionService _encryptionService;

    public AssemblyMinutesPdfService(
        IRepository<Assembly> assemblyRepository,
        IRepository<Condominium> condominiumRepository,
        IEncryptionService encryptionService)
    {
        _assemblyRepository = assemblyRepository;
        _condominiumRepository = condominiumRepository;
        _encryptionService = encryptionService;

        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<(byte[] PdfBytes, string FileName)> GenerateAsync(Guid assemblyId, Guid condominiumId)
    {
        var assembly = await _assemblyRepository.GetByIdAsync(assemblyId);
        if (assembly == null)
            throw new InvalidOperationException("Assembly not found.");

        if (assembly.CondominiumId != condominiumId)
            throw new InvalidOperationException("Assembly does not belong to the specified condominium.");

        if (assembly.Status != AssemblyStatus.Completed)
            throw new InvalidOperationException("Minutes PDF is only available for completed assemblies.");

        if (string.IsNullOrWhiteSpace(assembly.Minutes))
            throw new InvalidOperationException("Assembly minutes are empty.");

        var condominium = await _condominiumRepository.GetByIdAsync(assembly.CondominiumId);
        if (condominium == null)
            throw new InvalidOperationException("Condominium not found.");

        var pdfBytes = BuildPdf(assembly, condominium);
        var safeTitle = string.Join("_", assembly.Title.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        var fileName = $"ATA_{safeTitle}_{assembly.ScheduledAt:yyyyMMdd}.pdf";

        return (pdfBytes, fileName);
    }

    private byte[] BuildPdf(Assembly assembly, Condominium condominium)
    {
        var condominiumName = condominium.Name;
        var address = DecryptIfPresent(condominium.AddressEncrypted);
        var postalCode = DecryptIfPresent(condominium.PostalCodeEncrypted);
        var locality = DecryptIfPresent(condominium.LocalityEncrypted);
        var taxId = DecryptIfPresent(condominium.TaxIdEncrypted);

        var document = QuestPDF.Fluent.Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily("Arial"));

                page.Header().Element(header =>
                {
                    header.Column(column =>
                    {
                        column.Spacing(2);
                        column.Item().Text(text => text.Span(condominiumName.ToUpperInvariant()).Bold().FontSize(14));

                        if (!string.IsNullOrWhiteSpace(address))
                            column.Item().Text(text => text.Span(address).FontSize(10));

                        var postalAndLocality = FormatPostalCodeAndLocality(postalCode, locality);
                        if (!string.IsNullOrWhiteSpace(postalAndLocality))
                            column.Item().Text(text => text.Span(postalAndLocality).FontSize(10));

                        if (!string.IsNullOrWhiteSpace(taxId))
                            column.Item().Text(text => text.Span($"NIPC: {taxId}").FontSize(10));
                    });
                });

                page.Content().PaddingVertical(20).Column(column =>
                {
                    column.Spacing(12);

                    column.Item().AlignCenter().Text(text =>
                    {
                        text.Span("ATA DE ASSEMBLEIA").Bold().FontSize(16);
                    });

                    column.Item().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingBottom(8).Column(info =>
                    {
                        info.Spacing(4);
                        info.Item().Text(text =>
                        {
                            text.Span("Assembleia: ").Bold();
                            text.Span(assembly.Title);
                        });
                        info.Item().Text(text =>
                        {
                            text.Span("Data: ").Bold();
                            text.Span(assembly.ScheduledAt.ToString("dd/MM/yyyy HH:mm"));
                        });
                        info.Item().Text(text =>
                        {
                            text.Span("Local: ").Bold();
                            text.Span(assembly.Location);
                        });
                        info.Item().Text(text =>
                        {
                            text.Span("Estado: ").Bold();
                            text.Span("Concluída");
                        });
                    });

                    column.Item().Element(content => RenderHtmlContent(content, assembly.Minutes!));
                });

                page.Footer()
                    .PaddingTop(10)
                    .BorderTop(1)
                    .BorderColor(Colors.Grey.Lighten2)
                    .PaddingTop(6)
                    .AlignCenter()
                    .Text(text =>
                    {
                        text.Span("Documento gerado eletronicamente pela plataforma HABITUS • ").FontSize(8).FontColor(Colors.Grey.Darken2);
                        text.Span(DateTime.UtcNow.ToString("dd/MM/yyyy HH:mm")).FontSize(8).FontColor(Colors.Grey.Darken2);
                    });
            });
        });

        return document.GeneratePdf();
    }

    private static void RenderHtmlContent(IContainer container, string html)
    {
        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        container.Column(column =>
        {
            column.Spacing(8);
            foreach (var node in doc.DocumentNode.ChildNodes)
            {
                RenderNode(column, node);
            }
        });
    }

    private static void RenderNode(ColumnDescriptor column, HtmlNode node)
    {
        if (node.NodeType == HtmlNodeType.Text)
        {
            var text = HtmlEntity.DeEntitize(node.InnerText).Trim();
            if (!string.IsNullOrWhiteSpace(text))
            {
                column.Item().Text(text);
            }
            return;
        }

        var tagName = node.Name.ToLowerInvariant();
        switch (tagName)
        {
            case "p":
                column.Item().Text(HtmlEntity.DeEntitize(node.InnerText));
                break;
            case "h1":
                column.Item().Text(text => text.Span(HtmlEntity.DeEntitize(node.InnerText)).Bold().FontSize(18));
                break;
            case "h2":
                column.Item().Text(text => text.Span(HtmlEntity.DeEntitize(node.InnerText)).Bold().FontSize(16));
                break;
            case "h3":
            case "h4":
            case "h5":
            case "h6":
                column.Item().Text(text => text.Span(HtmlEntity.DeEntitize(node.InnerText)).Bold().FontSize(13));
                break;
            case "ul":
                foreach (var li in node.SelectNodes(".//li") ?? Enumerable.Empty<HtmlNode>())
                {
                    column.Item().PaddingLeft(10).Text(text =>
                    {
                        text.Span("• ").FontSize(11);
                        text.Span(HtmlEntity.DeEntitize(li.InnerText));
                    });
                }
                break;
            case "ol":
                var index = 1;
                foreach (var li in node.SelectNodes(".//li") ?? Enumerable.Empty<HtmlNode>())
                {
                    column.Item().PaddingLeft(10).Text(text =>
                    {
                        text.Span($"{index}. ").FontSize(11);
                        text.Span(HtmlEntity.DeEntitize(li.InnerText));
                    });
                    index++;
                }
                break;
            case "br":
                column.Item().PaddingVertical(2);
                break;
            case "div":
                foreach (var child in node.ChildNodes)
                {
                    RenderNode(column, child);
                }
                break;
            default:
                if (node.HasChildNodes)
                {
                    foreach (var child in node.ChildNodes)
                    {
                        RenderNode(column, child);
                    }
                }
                else
                {
                    var text = HtmlEntity.DeEntitize(node.InnerText).Trim();
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        column.Item().Text(text);
                    }
                }
                break;
        }
    }

    private string? DecryptIfPresent(string? encryptedValue)
    {
        return string.IsNullOrWhiteSpace(encryptedValue)
            ? null
            : _encryptionService.Decrypt(encryptedValue);
    }

    private static string FormatPostalCodeAndLocality(string? postalCode, string? locality)
    {
        var parts = new[] { postalCode?.Trim(), locality?.Trim() }
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .ToArray();

        return parts.Length == 0 ? string.Empty : string.Join(" ", parts);
    }
}

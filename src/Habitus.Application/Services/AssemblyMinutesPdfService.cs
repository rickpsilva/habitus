using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using HtmlAgilityPack;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Globalization;

namespace Habitus.Application.Services;

/// <summary>
/// Generates a downloadable PDF for completed assembly minutes (ATA), preserving
/// the HTML formatting produced by the rich-text editor (headings, bold, italic,
/// underline, strikethrough, text color, alignment, links and nested lists).
/// </summary>
public class AssemblyMinutesPdfService
{
    private const int BaseFontSize = 11;
    private const int Heading1FontSize = 20;
    private const int Heading2FontSize = 17;
    private const int Heading3FontSize = 14;

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
                page.DefaultTextStyle(x => x.FontSize(BaseFontSize).FontFamily("Arial"));

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
                RenderBlockNode(column, node, new HtmlRenderContext());
            }
        });
    }

    private static void RenderBlockNode(ColumnDescriptor column, HtmlNode node, HtmlRenderContext context)
    {
        if (node.NodeType == HtmlNodeType.Text)
        {
            var text = NormalizeText(node.InnerText);
            if (!string.IsNullOrWhiteSpace(text))
            {
                column.Item().Text(text);
            }
            return;
        }

        if (node.NodeType == HtmlNodeType.Comment)
            return;

        var tagName = node.Name.ToLowerInvariant();
        switch (tagName)
        {
            case "p":
                RenderTextContainer(column, node, context with { FontSize = BaseFontSize }, alignment: ResolveAlignment(node));
                break;
            case "h1":
                RenderTextContainer(column, node, context with { FontSize = Heading1FontSize, IsBold = true }, alignment: ResolveAlignment(node));
                break;
            case "h2":
                RenderTextContainer(column, node, context with { FontSize = Heading2FontSize, IsBold = true }, alignment: ResolveAlignment(node));
                break;
            case "h3":
            case "h4":
            case "h5":
            case "h6":
                RenderTextContainer(column, node, context with { FontSize = Heading3FontSize, IsBold = true }, alignment: ResolveAlignment(node));
                break;
            case "ul":
                RenderList(column, node, context, ordered: false);
                break;
            case "ol":
                RenderList(column, node, context, ordered: true);
                break;
            case "br":
                column.Item().PaddingVertical(2);
                break;
            case "hr":
                column.Item().PaddingVertical(6).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                break;
            case "blockquote":
                column.Item()
                    .BorderLeft(4)
                    .BorderColor(Colors.Grey.Lighten1)
                    .PaddingLeft(10)
                    .PaddingVertical(4)
                    .Background(Colors.Grey.Lighten3)
                    .Element(inner => RenderHtmlNode(inner, node, context));
                break;
            case "div":
            case "section":
            case "article":
            case "main":
            case "header":
            case "footer":
            case "body":
            case "html":
                foreach (var child in node.ChildNodes)
                {
                    RenderBlockNode(column, child, context);
                }
                break;
            default:
                RenderTextContainer(column, node, context, alignment: ResolveAlignment(node));
                break;
        }
    }

    private static void RenderTextContainer(
        ColumnDescriptor column,
        HtmlNode node,
        HtmlRenderContext context,
        HorizontalAlignment? alignment = null)
    {
        var item = column.Item();
        var aligned = alignment switch
        {
            HorizontalAlignment.Center => item.AlignCenter(),
            HorizontalAlignment.Right => item.AlignRight(),
            _ => item,
        };

        aligned.Text(text =>
        {
            foreach (var child in node.ChildNodes)
            {
                RenderInlineNode(text, child, context);
            }
        });
    }

    private static void RenderInlineNode(TextDescriptor text, HtmlNode node, HtmlRenderContext context)
    {
        if (node.NodeType == HtmlNodeType.Text)
        {
            var value = NormalizeText(node.InnerText);
            if (!string.IsNullOrEmpty(value))
            {
                ApplyStyle(text.Span(value), context);
            }
            return;
        }

        if (node.NodeType == HtmlNodeType.Comment)
            return;

        var tagName = node.Name.ToLowerInvariant();
        var childContext = context.ApplyNode(node);

        foreach (var child in node.ChildNodes)
        {
            RenderInlineNode(text, child, childContext);
        }
    }

    private static void RenderList(ColumnDescriptor column, HtmlNode listNode, HtmlRenderContext context, bool ordered)
    {
        var items = listNode.SelectNodes("./li") ?? Enumerable.Empty<HtmlNode>();
        var index = 1;

        foreach (var li in items)
        {
            var marker = ordered ? $"{index}. " : "• ";
            index++;

            column.Item().PaddingLeft(12).Element(itemContainer =>
            {
                itemContainer.Column(nestedColumn =>
                {
                    nestedColumn.Item().Element(markerRow =>
                    {
                        markerRow.Row(row =>
                        {
                            row.ConstantItem(18).Text(marker);
                            row.RelativeItem().Column(contentColumn =>
                            {
                                foreach (var child in li.ChildNodes)
                                {
                                    if (IsBlockElement(child))
                                    {
                                        RenderBlockNode(contentColumn, child, context);
                                    }
                                    else
                                    {
                                        contentColumn.Item().Text(text =>
                                        {
                                            RenderInlineNode(text, child, context);
                                        });
                                    }
                                }
                            });
                        });
                    });
                });
            });
        }
    }

    private static void RenderHtmlNode(IContainer container, HtmlNode node, HtmlRenderContext context)
    {
        container.Column(column =>
        {
            foreach (var child in node.ChildNodes)
            {
                RenderBlockNode(column, child, context);
            }
        });
    }

    private static TextSpanDescriptor ApplyStyle(TextSpanDescriptor span, HtmlRenderContext context)
    {
        var styled = span;

        if (context.IsBold)
            styled = styled.Bold();

        if (context.IsItalic)
            styled = styled.Italic();

        if (context.IsUnderline)
            styled = styled.Underline();

        if (context.IsStrikethrough)
            styled = styled.Strikethrough();

        if (context.FontSize.HasValue)
            styled = styled.FontSize(context.FontSize.Value);

        if (!string.IsNullOrEmpty(context.Color))
            styled = styled.FontColor(context.Color);

        if (!string.IsNullOrEmpty(context.LinkUrl))
        {
            styled = styled.FontColor(Colors.Blue.Medium).Underline();
        }

        return styled;
    }

    private static HorizontalAlignment? ResolveAlignment(HtmlNode node)
    {
        var style = node.GetAttributeValue("style", string.Empty);
        var align = ExtractStyleValue(style, "text-align");

        if (string.IsNullOrEmpty(align))
        {
            align = node.GetAttributeValue("align", string.Empty).ToLowerInvariant();
        }

        return align switch
        {
            "center" => HorizontalAlignment.Center,
            "right" => HorizontalAlignment.Right,
            "left" => HorizontalAlignment.Left,
            _ => null,
        };
    }

    private static string ExtractStyleValue(string style, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(style))
            return string.Empty;

        var declarations = style.Split(';', StringSplitOptions.RemoveEmptyEntries);
        foreach (var declaration in declarations)
        {
            var parts = declaration.Split(':', 2);
            if (parts.Length != 2)
                continue;

            var name = parts[0].Trim().ToLowerInvariant();
            var value = parts[1].Trim().ToLowerInvariant();

            if (name.Equals(propertyName, StringComparison.OrdinalIgnoreCase))
                return value;
        }

        return string.Empty;
    }

    private static string ExtractColorValue(string style)
    {
        var color = ExtractStyleValue(style, "color");
        if (string.IsNullOrEmpty(color))
            return string.Empty;

        return TryParseColor(color, out var parsed) ? parsed : string.Empty;
    }

    private static bool TryParseColor(string color, out string normalizedColor)
    {
        normalizedColor = string.Empty;

        if (color.StartsWith('#'))
        {
            normalizedColor = color.ToUpperInvariant();
            return true;
        }

        if (color.StartsWith("rgb"))
        {
            var values = color.Replace("rgba", string.Empty)
                              .Replace("rgb", string.Empty)
                              .Replace("(", string.Empty)
                              .Replace(")", string.Empty)
                              .Split(',');

            if (values.Length >= 3 &&
                byte.TryParse(values[0].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var r) &&
                byte.TryParse(values[1].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var g) &&
                byte.TryParse(values[2].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var b))
            {
                normalizedColor = $"#{r:X2}{g:X2}{b:X2}";
                return true;
            }
        }

        return false;
    }

    private static string NormalizeText(string text)
    {
        var decoded = HtmlEntity.DeEntitize(text);
        if (string.IsNullOrEmpty(decoded))
            return string.Empty;

        // Replace non-breaking spaces and collapse whitespace, but keep a single space.
        var normalized = decoded.Replace("\u00a0", " ").Replace("\r", " ").Replace("\n", " ").Replace("\t", " ");
        while (normalized.Contains("  "))
        {
            normalized = normalized.Replace("  ", " ");
        }

        return normalized;
    }

    private static bool IsBlockElement(HtmlNode node)
    {
        if (node.NodeType != HtmlNodeType.Element)
            return false;

        var blockTags = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
            "blockquote", "pre", "section", "article", "header", "footer", "hr"
        };

        return blockTags.Contains(node.Name);
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

    /// <summary>
    /// Holds the current text style state while recursively walking the HTML DOM.
    /// </summary>
    private readonly record struct HtmlRenderContext(
        bool IsBold,
        bool IsItalic,
        bool IsUnderline,
        bool IsStrikethrough,
        int? FontSize,
        string Color,
        string LinkUrl)
    {
        public HtmlRenderContext()
            : this(false, false, false, false, null, string.Empty, string.Empty)
        {
        }

        public HtmlRenderContext ApplyNode(HtmlNode node)
        {
            var tagName = node.Name.ToLowerInvariant();
            var style = node.GetAttributeValue("style", string.Empty);

            var isBold = IsBold || tagName is "strong" or "b";
            var isItalic = IsItalic || tagName is "em" or "i";
            var isUnderline = IsUnderline || tagName is "u" or "ins";
            var isStrikethrough = IsStrikethrough || tagName is "s" or "strike" or "del";

            var color = ExtractColorValue(style);
            if (string.IsNullOrEmpty(color))
            {
                color = node.GetAttributeValue("color", string.Empty).Trim();
                if (!string.IsNullOrEmpty(color) && !TryParseColor(color, out _))
                {
                    color = string.Empty;
                }
            }
            if (string.IsNullOrEmpty(color))
            {
                color = Color;
            }

            var linkUrl = LinkUrl;
            if (tagName == "a")
            {
                linkUrl = node.GetAttributeValue("href", string.Empty).Trim();
            }

            return new HtmlRenderContext(
                isBold,
                isItalic,
                isUnderline,
                isStrikethrough,
                FontSize,
                color,
                linkUrl);
        }
    }
}

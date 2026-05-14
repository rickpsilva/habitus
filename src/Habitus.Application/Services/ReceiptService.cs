using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using HtmlAgilityPack;
using Markdig;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Net;
using System.Text.RegularExpressions;
using DomainUnit = Habitus.Domain.Entities.Unit;

namespace Habitus.Application.Services;

public class ReceiptService
{
    private readonly IRepository<Payment> _paymentRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<DomainUnit> _unitRepository;
    private readonly IRepository<Condominium> _condominiumRepository;
    private readonly IRepository<ReceiptTemplateSettings> _receiptTemplateSettingsRepository;

    public ReceiptService(
        IRepository<Payment> paymentRepository,
        IRepository<User> userRepository,
        IRepository<DomainUnit> unitRepository,
        IRepository<Condominium> condominiumRepository,
        IRepository<ReceiptTemplateSettings> receiptTemplateSettingsRepository)
    {
        _paymentRepository = paymentRepository;
        _userRepository = userRepository;
        _unitRepository = unitRepository;
        _condominiumRepository = condominiumRepository;
        _receiptTemplateSettingsRepository = receiptTemplateSettingsRepository;
        
        // Configure QuestPDF license (Community license is free for open source)
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<string> GenerateReceiptPdfAsync(Guid paymentId, Guid issuedByUserId)
    {
        var payment = await _paymentRepository.GetByIdAsync(paymentId);
        if (payment == null)
            throw new InvalidOperationException("Payment not found");

        if (payment.Status != PaymentStatus.Approved)
            throw new InvalidOperationException("Only approved payments can have receipts issued");

        var resident = await _userRepository.GetByIdAsync(payment.ResidentId);
        var unit = await _unitRepository.GetByIdAsync(payment.UnitId);
        var condominium = await _condominiumRepository.GetByIdAsync(payment.CondominiumId);
        var issuedBy = await _userRepository.GetByIdAsync(issuedByUserId);
        var templateSettings = (await _receiptTemplateSettingsRepository.FindAsync(rts => rts.CondominiumId == payment.CondominiumId))
            .FirstOrDefault();

        if (resident == null || unit == null || condominium == null || issuedBy == null)
            throw new InvalidOperationException("Required entities not found");

        // Get next receipt number for this year
        var currentYear = DateTime.UtcNow.Year;
        var maxReceiptNumber = (await _paymentRepository.FindAsync(
            p => p.ReceiptYear == currentYear && p.ReceiptNumber.HasValue))
            .Max(p => p.ReceiptNumber) ?? 0;
        
        var receiptNumber = maxReceiptNumber + 1;

        // Update payment with receipt information
        payment.ReceiptNumber = receiptNumber;
        payment.ReceiptYear = currentYear;
        payment.ReceiptIssuedDate = DateTime.UtcNow;
        payment.ReceiptIssuedByUserId = issuedByUserId;

        // Generate PDF
        var pdfBytes = GenerateReceiptPdf(payment, resident, unit, condominium, issuedBy, templateSettings, receiptNumber, currentYear);

        // Save PDF to disk (in production, save to blob storage)
        var fileName = $"receipt_{receiptNumber}_{currentYear}_{payment.Id}.pdf";
        var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "receipts");
        Directory.CreateDirectory(uploadsPath);
        
        var filePath = Path.Combine(uploadsPath, fileName);
        await File.WriteAllBytesAsync(filePath, pdfBytes);

        payment.ReceiptPdfPath = $"/receipts/{fileName}";

        _paymentRepository.Update(payment);
        await _paymentRepository.SaveChangesAsync();

        return payment.ReceiptPdfPath;
    }

    private byte[] GenerateReceiptPdf(
        Payment payment,
        User resident,
        DomainUnit unit,
        Condominium condominium,
        User issuedBy,
        ReceiptTemplateSettings? templateSettings,
        int receiptNumber,
        int receiptYear)
    {
        var companyName = templateSettings?.CompanyName ?? condominium.Name;
        var companyAddress = templateSettings?.Address ?? condominium.Address;
        var companyPostalCode = templateSettings?.PostalCode;
        var companyLocality = templateSettings?.Locality;
        var companyLocationLine = FormatPostalCodeAndLocality(companyPostalCode, companyLocality);
        var companyTaxId = templateSettings?.TaxId ?? condominium.TaxId;
        var templateBody = BuildReceiptBody(payment, resident, unit, condominium, templateSettings);

        var document = QuestPDF.Fluent.Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily("Arial"));

                page.Content().Column(column =>
                {
                    column.Spacing(15);

                    // Header: Condominium Info
                    column.Item().Text(text =>
                    {
                        text.Span(companyName.ToUpperInvariant()).Bold().FontSize(14);
                    });

                    column.Item().Text(text =>
                    {
                        text.Span(companyAddress).FontSize(10);
                    });

                    if (!string.IsNullOrWhiteSpace(companyLocationLine))
                    {
                        column.Item().Text(text =>
                        {
                            text.Span(companyLocationLine).FontSize(10);
                        });
                    }
                    
                    if (!string.IsNullOrEmpty(companyTaxId))
                    {
                        column.Item().Text(text =>
                        {
                            text.Span($"NIPC: {companyTaxId}").FontSize(10);
                        });
                    }

                    column.Item().PaddingTop(10);

                    // Receipt Number (right aligned)
                    column.Item().AlignRight().Text(text =>
                    {
                        text.Span($"Nº {receiptNumber}/{receiptYear}").Bold().FontSize(12);
                    });

                    column.Item().PaddingTop(20);

                    // Receipt Body
                    RenderTemplateBody(column, templateBody);

                    column.Item().PaddingTop(30);
                });

                // Footer
                page.Footer()
                    .PaddingTop(10)
                    .BorderTop(1)
                    .BorderColor(Colors.Grey.Lighten2)
                    .PaddingTop(6)
                    .AlignCenter()
                    .Text(text =>
                    {
                        text.Span("Documento gerado eletronicamente • ").FontSize(8).FontColor(Colors.Grey.Darken2);
                        text.Span($"Emitido em {DateTime.UtcNow:dd/MM/yyyy HH:mm}").FontSize(8).FontColor(Colors.Grey.Darken2);
                    });
            });
        });

        return document.GeneratePdf();
    }

    private string BuildReceiptBody(
        Payment payment,
        User resident,
        DomainUnit unit,
        Condominium condominium,
        ReceiptTemplateSettings? templateSettings)
    {
        var rawTemplate = GetTemplateForPayment(payment, templateSettings);
        var template = string.IsNullOrWhiteSpace(rawTemplate)
            ? GetDefaultTemplate(payment)
            : rawTemplate.Trim();

        var now = DateTime.UtcNow;
        var periodMonthStart = payment.QuotaMonthStart ?? now.Month;
        var periodMonthEnd = payment.QuotaMonthEnd ?? periodMonthStart;
        var periodMonthName = GetPortugueseMonthName(periodMonthStart);
        var tokens = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["{resident_name}"] = resident.Name,
            ["{unit_number}"] = unit.Number,
            ["{unit_port}"] = unit.Floor.ToString(),
            ["{unit_build}"] = condominium.Name,
            ["{value_amount}"] = $"{payment.Amount:F2}",
            ["{quote_period_month_start}"] = GetPortugueseMonthName(periodMonthStart),
            ["{quote_period_month_end}"] = GetPortugueseMonthName(periodMonthEnd),
            ["{quote_period_month}"] = payment.Type == PaymentType.MonthlyFee && payment.QuotaPeriodicity == QuotaPeriodicity.Monthly ? periodMonthName : string.Empty,
            ["{quote_month_start}"] = GetPortugueseMonthName(periodMonthStart),
            ["{quote_month_end}"] = GetPortugueseMonthName(periodMonthEnd),
            ["{quote_mouth_start}"] = GetPortugueseMonthName(periodMonthStart),
            ["{quote_mouth_end}"] = GetPortugueseMonthName(periodMonthEnd),
            ["{quote_year}"] = (payment.QuotaYear ?? now.Year).ToString(),
            ["{current_day}"] = now.Day.ToString(),
            ["{current_month}"] = GetPortugueseMonthName(now.Month),
            ["{current_year}"] = now.Year.ToString()
        };

        foreach (var token in tokens)
        {
            template = template.Replace(token.Key, token.Value, StringComparison.OrdinalIgnoreCase);
        }

        return ConvertTemplateToHtml(template);
    }

    private string? GetTemplateForPayment(Payment payment, ReceiptTemplateSettings? templateSettings)
    {
        if (templateSettings == null)
            return null;

        return payment.Type switch
        {
            PaymentType.MonthlyFee => payment.QuotaPeriodicity switch
            {
                QuotaPeriodicity.Monthly => templateSettings.TemplateMonthlyFee ?? templateSettings.Template,
                QuotaPeriodicity.Quarterly => templateSettings.TemplateMonthlyFeeQuarterly ?? templateSettings.TemplateMonthlyFee ?? templateSettings.Template,
                QuotaPeriodicity.Annual => templateSettings.TemplateMonthlyFeeAnnual ?? templateSettings.TemplateMonthlyFeeQuarterly ?? templateSettings.TemplateMonthlyFee ?? templateSettings.Template,
                _ => templateSettings.TemplateMonthlyFee ?? templateSettings.Template
            },
            PaymentType.ExtraordinaryFee => templateSettings.TemplateExtraordinaryFee ?? templateSettings.Template,
            PaymentType.Reservation => templateSettings.TemplateReservation ?? templateSettings.Template,
            _ => templateSettings.TemplateOther ?? templateSettings.Template
        };
    }

    private string GetDefaultTemplate(Payment payment)
    {
        if (payment.Type == PaymentType.MonthlyFee)
        {
            return payment.QuotaPeriodicity switch
            {
                QuotaPeriodicity.Quarterly => "<p>Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, referente às quotas do período de {quote_period_month_start} a {quote_period_month_end}.</p>",
                QuotaPeriodicity.Annual => "<p>Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, referente às quotas do período de {quote_period_month_start} a {quote_period_month_end}.</p>",
                _ => "<p>Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, referente à quota do mês de {quote_period_month}.</p>"
            };
        }

        return payment.Type switch
        {
            PaymentType.ExtraordinaryFee => "<p>Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, referente a quota extraordinária.</p>",
            PaymentType.Reservation => "<p>Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, referente a pagamento de reserva.</p>",
            _ => "<p>Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, referente ao pagamento efetuado.</p>"
        };
    }

    private string ConvertTemplateToHtml(string templateBody)
    {
        if (string.IsNullOrWhiteSpace(templateBody))
        {
            return string.Empty;
        }

        if (LooksLikeHtml(templateBody))
        {
            return templateBody;
        }

        return Markdown.ToHtml(templateBody);
    }

    private static bool LooksLikeHtml(string templateBody)
    {
        return Regex.IsMatch(templateBody, "<\\/?[a-zA-Z][^>]*>");
    }

    private string GetDefaultTemplate(PaymentType paymentType)
    {
        return paymentType switch
        {
            PaymentType.MonthlyFee => "Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, valor destinado às quotas para comparticipação nas despesas de Condomínio e Fundo Comum de Reserva.",
            PaymentType.ExtraordinaryFee => "Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, referente a quota extraordinária.",
            PaymentType.Reservation => "Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, referente a pagamento de reserva.",
            _ => "Recebemos do Sr./a. {resident_name}, proprietário da {unit_number} - {unit_port}, {unit_build}, a quantia de {value_amount} euros, referente ao pagamento efetuado."
        };
    }

    private void RenderTemplateBody(ColumnDescriptor column, string templateBody)
    {
        if (string.IsNullOrWhiteSpace(templateBody))
        {
            return;
        }

        var document = new HtmlDocument();
        document.LoadHtml($"<root>{templateBody}</root>");

        var root = document.DocumentNode.SelectSingleNode("/root");
        if (root == null)
        {
            return;
        }

        var childNodes = root.ChildNodes.Where(n =>
            n.NodeType == HtmlNodeType.Element ||
            (n.NodeType == HtmlNodeType.Text && !string.IsNullOrWhiteSpace(WebUtility.HtmlDecode(n.InnerText))));

        foreach (var node in childNodes)
        {
            RenderBlockNode(column, node);
        }
    }

    private void RenderBlockNode(ColumnDescriptor column, HtmlNode node)
    {
        if (node.NodeType == HtmlNodeType.Text)
        {
            var plainText = NormalizeTextNode(node.InnerText);
            if (string.IsNullOrWhiteSpace(plainText))
            {
                return;
            }

            column.Item().PaddingBottom(4).Text(text =>
            {
                text.DefaultTextStyle(t => t.FontSize(11).LineHeight(1.5f));
                text.Span(plainText);
            });
            return;
        }

        var tag = node.Name.ToLowerInvariant();
        var alignment = GetTextAlignment(node);
        var blockFontSize = GetFontSize(node, 11f);

        if (tag == "ul" || tag == "ol")
        {
            var index = 1;
            foreach (var child in node.ChildNodes.Where(n => n.Name.Equals("li", StringComparison.OrdinalIgnoreCase)))
            {
                var prefix = tag == "ol" ? $"{index}. " : "• ";
                var listNode = child;
                column.Item().PaddingBottom(4).AlignLeft().Text(text =>
                {
                    text.DefaultTextStyle(t => t.FontSize(blockFontSize).LineHeight(1.5f));
                    text.Span(prefix).Bold();
                    AppendInlineNodes(text, listNode, new InlineTextStyle());
                });
                index++;
            }
            return;
        }

        var blockStyle = new InlineTextStyle();
        var fontSize = blockFontSize;

        if (tag == "h1")
        {
            blockStyle = blockStyle with { Bold = true };
            fontSize = 18f;
        }
        else if (tag == "h2")
        {
            blockStyle = blockStyle with { Bold = true };
            fontSize = 16f;
        }
        else if (tag == "h3")
        {
            blockStyle = blockStyle with { Bold = true };
            fontSize = 14f;
        }

        var blockItem = column.Item().PaddingBottom(tag is "p" or "div" ? 8 : 4);
        if (alignment == BlockAlignment.Center)
        {
            blockItem = blockItem.AlignCenter();
        }
        else if (alignment == BlockAlignment.Right)
        {
            blockItem = blockItem.AlignRight();
        }

        blockItem.Text(text =>
        {
            text.DefaultTextStyle(t => t.FontSize(fontSize).LineHeight(1.5f));
            AppendInlineNodes(text, node, blockStyle);
        });
    }

    private void AppendInlineNodes(TextDescriptor text, HtmlNode node, InlineTextStyle style)
    {
        foreach (var child in node.ChildNodes)
        {
            if (child.NodeType == HtmlNodeType.Text)
            {
                var content = NormalizeTextNode(child.InnerText);
                if (string.IsNullOrWhiteSpace(content))
                {
                    continue;
                }

                var span = text.Span(content);
                if (style.Bold) span = span.Bold();
                if (style.Italic) span = span.Italic();
                if (style.Underline) span = span.Underline();
                if (style.Strike) span = span.Strikethrough();
            }
            else if (child.NodeType == HtmlNodeType.Element)
            {
                var tag = child.Name.ToLowerInvariant();

                if (tag == "br")
                {
                    text.Span("\n");
                    continue;
                }

                var nextStyle = style;

                if (tag is "strong" or "b") nextStyle = nextStyle with { Bold = true };
                if (tag is "em" or "i") nextStyle = nextStyle with { Italic = true };
                if (tag == "u") nextStyle = nextStyle with { Underline = true };
                if (tag is "s" or "strike") nextStyle = nextStyle with { Strike = true };
                if (tag == "a") nextStyle = nextStyle with { Underline = true };

                if (TryGetInlineFontWeight(child, out var inlineBold) && inlineBold)
                {
                    nextStyle = nextStyle with { Bold = true };
                }

                if (TryGetInlineFontStyle(child, out var italic) && italic)
                {
                    nextStyle = nextStyle with { Italic = true };
                }

                if (TryGetInlineTextDecoration(child, out var underline, out var strike))
                {
                    if (underline) nextStyle = nextStyle with { Underline = true };
                    if (strike) nextStyle = nextStyle with { Strike = true };
                }

                AppendInlineNodes(text, child, nextStyle);
            }
        }
    }

    private static string NormalizeTextNode(string text)
    {
        var decoded = WebUtility.HtmlDecode(text);
        return Regex.Replace(decoded, "\\s+", " ");
    }

    private static BlockAlignment GetTextAlignment(HtmlNode node)
    {
        var style = node.GetAttributeValue("style", string.Empty);
        if (style.Contains("text-align:center", StringComparison.OrdinalIgnoreCase) || style.Contains("text-align: center", StringComparison.OrdinalIgnoreCase))
        {
            return BlockAlignment.Center;
        }

        if (style.Contains("text-align:right", StringComparison.OrdinalIgnoreCase) || style.Contains("text-align: right", StringComparison.OrdinalIgnoreCase))
        {
            return BlockAlignment.Right;
        }

        return BlockAlignment.Left;
    }

    private static float GetFontSize(HtmlNode node, float fallback)
    {
        var style = node.GetAttributeValue("style", string.Empty);
        var match = Regex.Match(style, @"font-size\s*:\s*(\d+(?:\.\d+)?)px", RegexOptions.IgnoreCase);
        if (match.Success && float.TryParse(match.Groups[1].Value, out var size))
        {
            return size;
        }

        return fallback;
    }

    private static bool TryGetInlineFontWeight(HtmlNode node, out bool isBold)
    {
        isBold = false;
        var style = node.GetAttributeValue("style", string.Empty);
        if (string.IsNullOrWhiteSpace(style))
        {
            return false;
        }

        if (style.Contains("font-weight:bold", StringComparison.OrdinalIgnoreCase) ||
            style.Contains("font-weight: bold", StringComparison.OrdinalIgnoreCase))
        {
            isBold = true;
            return true;
        }

        var match = Regex.Match(style, @"font-weight\s*:\s*(\d+)", RegexOptions.IgnoreCase);
        if (match.Success && int.TryParse(match.Groups[1].Value, out var weight))
        {
            isBold = weight >= 600;
            return true;
        }

        return false;
    }

    private static bool TryGetInlineFontStyle(HtmlNode node, out bool isItalic)
    {
        isItalic = false;
        var style = node.GetAttributeValue("style", string.Empty);
        if (string.IsNullOrWhiteSpace(style))
        {
            return false;
        }

        if (style.Contains("font-style:italic", StringComparison.OrdinalIgnoreCase) ||
            style.Contains("font-style: italic", StringComparison.OrdinalIgnoreCase))
        {
            isItalic = true;
            return true;
        }

        return false;
    }

    private static bool TryGetInlineTextDecoration(HtmlNode node, out bool underline, out bool strike)
    {
        underline = false;
        strike = false;

        var style = node.GetAttributeValue("style", string.Empty);
        if (string.IsNullOrWhiteSpace(style))
        {
            return false;
        }

        if (style.Contains("underline", StringComparison.OrdinalIgnoreCase))
        {
            underline = true;
        }

        if (style.Contains("line-through", StringComparison.OrdinalIgnoreCase))
        {
            strike = true;
        }

        return underline || strike;
    }

    private string NormalizeTemplate(string rawTemplate)
    {
        return rawTemplate.Trim();
    }

    private static string FormatPostalCodeAndLocality(string? postalCode, string? locality)
    {
        var parts = new[] { postalCode?.Trim(), locality?.Trim() }
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .ToArray();

        return parts.Length == 0 ? string.Empty : string.Join(" ", parts);
    }

    private enum BlockAlignment
    {
        Left,
        Center,
        Right
    }

    private readonly record struct InlineTextStyle(bool Bold = false, bool Italic = false, bool Underline = false, bool Strike = false);

    private string GetPortugueseMonthName(int month)
    {
        return month switch
        {
            1 => "Janeiro",
            2 => "Fevereiro",
            3 => "Março",
            4 => "Abril",
            5 => "Maio",
            6 => "Junho",
            7 => "Julho",
            8 => "Agosto",
            9 => "Setembro",
            10 => "Outubro",
            11 => "Novembro",
            12 => "Dezembro",
            _ => ""
        };
    }

    private string GetIssuanceLocation(string address)
    {
        // Extract city from address (simple extraction, can be improved)
        var parts = address.Split(',');
        if (parts.Length > 1)
        {
            // Try to get city/location from last part
            var lastPart = parts[^1].Trim();
            // If it starts with a digit, it's likely a postal code, use second to last
            if (parts.Length > 2 && char.IsDigit(lastPart[0]))
            {
                return parts[^2].Trim();
            }
            return lastPart;
        }
        // Fallback
        return "Local";
    }
}

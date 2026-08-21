import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ModalPopup from './ModalPopup';
import { Button } from './ui';
import { financialApi } from '../api/services';
import { useTranslation } from '../i18n/I18nProvider';
import type { AnnualFinancialReportDto } from '../types';

interface AnnualReportModalProps {
  open: boolean;
  onClose: () => void;
  condominiumId: string | null;
  year: number;
}

interface ReportContentProps {
  condominiumId: string;
  year: number;
}

const monthAbbreviations = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const monthAbbreviationsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMoneyPdf(value: number): string {
  return `${value.toFixed(2)} EUR`;
}

function formatMoneyPdfShort(value: number): string {
  return value.toFixed(0);
}

export default function AnnualReportModal({ open, onClose, condominiumId, year }: AnnualReportModalProps) {
  const { t } = useTranslation();

  return (
    <ModalPopup open={open} onClose={onClose} title={t('financial.report.title', { year })} maxWidthClass="max-w-6xl">
      {condominiumId && <ReportContent condominiumId={condominiumId} year={year} />}
    </ModalPopup>
  );
}

function ReportContent({ condominiumId, year }: ReportContentProps) {
  const { t, language, formatCurrency } = useTranslation();
  const [report, setReport] = useState<AnnualFinancialReportDto | null>(null);
  const [loadError, setLoadError] = useState('');
  const loading = report === null && loadError === '';

  useEffect(() => {
    let cancelled = false;

    financialApi.getAnnualReport(condominiumId, year)
      .then((response) => {
        if (!cancelled) setReport(response.data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('financial.report.error'));
      });

    return () => {
      cancelled = true;
    };
  }, [condominiumId, year, t]);

  const monthAbbr = language.startsWith('pt') ? monthAbbreviations : monthAbbreviationsEn;

  const exportPdf = () => {
    if (!report) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(t('financial.report.title', { year: report.year }), 14, 18);

    // Annual Summary Box
    doc.setFillColor(248, 249, 250);
    doc.rect(14, 25, 270, 22, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(t('financial.report.annualSummary'), 18, 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${t('financial.totalIncome')}: ${formatMoneyPdf(report.totalIncome)}`, 18, 39);
    doc.text(`${t('financial.totalExpenses')}: ${formatMoneyPdf(report.totalExpenses)}`, 100, 39);
    doc.text(`${t('financial.difference')}: ${formatMoneyPdf(report.balance)}`, 190, 39);

    // Monthly expenses by tag table with hierarchical structure
    const tagRows = report.expensesByTagMonthly.length > 0
      ? report.expensesByTagMonthly.map((row) => {
          const displayName = row.isTagGroup
            ? `#${row.tag}`
            : `    ${row.category}`; // Indent categories under tags
          return [
            displayName,
            ...row.monthlyValues.map(v => row.isTagGroup ? '' : (v > 0 ? formatMoneyPdfShort(v) : '-')),
            row.isTagGroup ? '' : formatMoneyPdf(row.total)
          ];
        })
      : [[t('financial.report.noData'), ...Array(12).fill('-'), '-']];

    autoTable(doc, {
      startY: 52,
      head: [[t('financial.report.tagCategory'), ...monthAbbr, t('financial.report.total')]],
      body: tagRows,
      styles: { fontSize: 9, cellPadding: 2, textColor: [33, 33, 33] },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontStyle: 'normal',
      },
      didParseCell: (data) => {
        const rowIndex = data.row.index;
        const rowData = report.expensesByTagMonthly[rowIndex];
        if (rowData?.isTagGroup) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 240, 250];
          data.cell.styles.textColor = [33, 33, 33];
        }
      },
    });

    doc.save(`annual-financial-report-${report.year}.pdf`);
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-6 w-1/3 bg-line rounded animate-pulse" />
        <div className="h-40 w-full bg-line rounded animate-pulse" />
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-red-600" role="alert">{loadError}</p>;
  }

  if (!report) return null;

  const isEmpty = report.totalIncome === 0
    && report.totalExpenses === 0
    && report.incomeByCategory.length === 0
    && report.expensesByTag.length === 0;

  const hasMonthlyData = report.expensesByTagMonthly.length > 0;

  return (
    <div className="space-y-6">
      {isEmpty && (
        <p className="text-sm text-ink-subtle">{t('financial.report.empty', { year })}</p>
      )}

      {/* Annual Financial Summary */}
      <div className="bg-surface border border-line rounded-lg p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">{t('financial.report.annualSummary')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-ink-subtle mb-1">{t('financial.totalIncome')}</p>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(report.totalIncome)}</p>
          </div>
          <div className="text-center border-x border-line">
            <p className="text-xs text-ink-subtle mb-1">{t('financial.totalExpenses')}</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(report.totalExpenses)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-ink-subtle mb-1">{t('financial.difference')}</p>
            <p className={`text-xl font-bold ${report.balance >= 0 ? 'text-blue-900 dark:text-blue-400' : 'text-orange-900 dark:text-orange-400'}`}>
              {formatCurrency(report.balance)}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-2">{t('financial.report.monthlyExpensesByTag')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-line">
            <thead className="bg-surface-muted">
              <tr className="text-left text-ink-subtle">
                <th className="py-2 px-2 border-b border-line font-medium min-w-[160px]">{t('financial.report.tagCategory')}</th>
                {monthAbbr.map((m, i) => (
                  <th key={i} className="py-2 px-1 border-b border-line font-medium text-center min-w-[50px]">{m}</th>
                ))}
                <th className="py-2 px-2 border-b border-line font-medium text-right min-w-[80px]">{t('financial.report.total')}</th>
              </tr>
            </thead>
            <tbody>
              {hasMonthlyData ? (
                report.expensesByTagMonthly.map((row, idx) => (
                  <tr
                    key={`${row.tag}-${row.category ?? 'header'}-${idx}`}
                    className={row.isTagGroup ? 'bg-surface-muted/60' : 'even:bg-surface-muted/30'}
                  >
                    <td className="py-2 px-2 border-b border-line/50">
                      {row.isTagGroup ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">#{row.tag}</span>
                      ) : (
                        <span className="pl-6 text-ink-subtle">{row.category}</span>
                      )}
                    </td>
                    {row.monthlyValues.map((v, i) => (
                      <td key={i} className="py-2 px-1 border-b border-line/50 text-center text-ink-subtle">
                        {row.isTagGroup ? '' : (v > 0 ? formatCurrency(v).replace('€', '').trim() : '-')}
                      </td>
                    ))}
                    <td className="py-2 px-2 border-b border-line/50 text-right">
                      {row.isTagGroup ? '' : <span className="font-semibold text-ink">{formatCurrency(row.total)}</span>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={14} className="py-4 text-center text-ink-subtle">{t('financial.report.noData')}</td>
                </tr>
              )}
            </tbody>
            {hasMonthlyData && (
              <tfoot className="bg-surface-muted font-semibold">
                <tr>
                  <td className="py-2 px-2 text-ink">{t('financial.report.total')}</td>
                  {report.monthlyBreakdown.map((m) => (
                    <td key={m.month} className="py-2 px-1 text-center text-ink">
                      {m.expenses > 0 ? formatCurrency(m.expenses).replace('€', '').trim() : '-'}
                    </td>
                  ))}
                  <td className="py-2 px-2 text-right text-ink">{formatCurrency(report.totalExpenses)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={exportPdf} icon={Download}>
          {t('financial.report.exportPdf')}
        </Button>
      </div>
    </div>
  );
}

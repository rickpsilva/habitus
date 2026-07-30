import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Check,
  Layers,
  Shield,
  TrendingUp,
  Building2,
  RefreshCw,
  X,
  ChevronDown,
  Plus,
  Pencil,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { subscriptionsApi, condominiumsApi, invoicesApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { Button, DataTable, EmptyState, StatCard, Card, Skeleton } from '../components/ui';
import type { Column } from '../components/ui';
import type {
  SubscriptionPlanDto,
  FeatureCatalogItemDto,
  CondominiumSubscriptionDto,
  CondominiumDto,
  AssignSubscriptionRequest,
  CreateSubscriptionPlanRequest,
  UpdateSubscriptionPlanRequest,
  InvoiceDto,
} from '../types';

const tierMeta: Record<string, { icon: React.ElementType; color: string; badge: string }> = {
  Free:   { icon: Layers,     color: 'border-line bg-surface-muted',          badge: 'bg-control text-ink-muted' },
  Silver: { icon: Shield,     color: 'border-amber-300 bg-amber-50',        badge: 'bg-amber-100 text-amber-700' },
  Gold:   { icon: TrendingUp, color: 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300', badge: 'bg-emerald-100 text-emerald-700' },
};

const cycleLabel: Record<string, string> = {
  Monthly: 'Mensal',
  Annual: 'Anual',
  Quinquennial: '5 Anos',
};

function fmt(value: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDiscount(value: number) {
  if (value <= 0) return null;
  return `-${value.toFixed(0)}%`;
}

type PlanFormState = {
  id?: string;
  name: string;
  tier: string;
  description: string;
  priceMonthly: number;
  annualDiscountPercent: number;
  quinquennialDiscountPercent: number;
  isActive: boolean;
  features: Record<string, boolean>;
};

const emptyPlanForm = (): PlanFormState => ({
  name: '',
  tier: 'Free',
  description: '',
  priceMonthly: 0,
  annualDiscountPercent: 0,
  quinquennialDiscountPercent: 0,
  isActive: true,
  features: {},
});

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function calculateDiscountedPrice(baseMonthly: number, months: number, discountPercent: number) {
  if (baseMonthly <= 0) return 0;
  const raw = baseMonthly * months * (1 - discountPercent / 100);
  return roundMoney(Math.max(raw, 0));
}

// ============= Invoice Status Helpers =============

const statusMeta: Record<InvoiceDto['status'], { label: string; className: string; icon: React.ElementType }> = {
  Draft:     { label: 'Rascunho', className: 'bg-control text-ink-muted', icon: Clock },
  Emitted:   { label: 'Emitida',  className: 'bg-blue-100 text-blue-700', icon: FileText },
  Paid:      { label: 'Paga',     className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  Overdue:   { label: 'Vencida',  className: 'bg-red-100 text-red-700', icon: AlertTriangle },
  Cancelled: { label: 'Cancelada', className: 'bg-control text-ink-muted', icon: XCircle },
};

function StatusBadge({ status }: { status: InvoiceDto['status'] }) {
  const meta = statusMeta[status] ?? statusMeta.Draft;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.className}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ============= Invoices Dashboard Sub-component =============

function InvoicesDashboard({ condominiums }: { condominiums: CondominiumDto[] }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [confirmGenerateDue, setConfirmGenerateDue] = useState(false);
  const [cancelInvoiceId, setCancelInvoiceId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedCondoId, setSelectedCondoId] = useState<string>(condominiums[0]?.id ?? '');
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDto | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [saftYear, setSaftYear] = useState<string>(String(new Date().getFullYear()));
  const [generatingInvoices, setGeneratingInvoices] = useState(false);

  const years = Array.from(new Set([
    String(new Date().getFullYear()),
    String(new Date().getFullYear() - 1),
    ...invoices.map((i) => String(i.year)),
  ])).sort((a, b) => Number(b) - Number(a));

  const loadInvoices = async (condoId: string) => {
    if (!condoId) return;
    setLoading(true);
    setError('');
    try {
      const res = await invoicesApi.list(condoId);
      setInvoices(res.data);
    } catch {
      setError('Não foi possível carregar as faturas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCondoId) loadInvoices(selectedCondoId);
  }, [selectedCondoId]);

  const filtered = invoices.filter((inv) => {
    const statusOk = statusFilter === 'all' || inv.status === statusFilter;
    const yearOk   = yearFilter === 'all' || String(inv.year) === yearFilter;
    return statusOk && yearOk;
  });

  const totalPaid    = invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.totalAmount, 0);
  const totalOverdue = invoices.filter((i) => i.status === 'Overdue').reduce((s, i) => s + i.totalAmount, 0);
  const totalEmitted = invoices.filter((i) => i.status === 'Emitted').reduce((s, i) => s + i.totalAmount, 0);
  const overdueCount = invoices.filter((i) => i.status === 'Overdue').length;

  const handleMarkPaid = async (invoiceId: string) => {
    setActionLoading(invoiceId);
    setActionError('');
    try {
      const updated = await invoicesApi.markPaid(invoiceId, {});
      setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? updated.data : i)));
      if (selectedInvoice?.id === invoiceId) setSelectedInvoice(updated.data);
    } catch {
      setActionError('Erro ao marcar fatura como paga.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (invoiceId: string, reason: string) => {
    setActionLoading(invoiceId);
    setActionError('');
    try {
      const updated = await invoicesApi.cancel(invoiceId, { reason });
      setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? updated.data : i)));
      if (selectedInvoice?.id === invoiceId) setSelectedInvoice(updated.data);
    } catch {
      setActionError('Erro ao cancelar fatura.');
    } finally {
      setActionLoading(null);
    }
  };

  const openCancelModal = (invoiceId: string) => {
    setCancelInvoiceId(invoiceId);
    setCancelReason('');
  };

  const confirmCancelInvoice = async () => {
    if (!cancelInvoiceId) return;
    if (!cancelReason.trim()) {
      setActionError('Indique o motivo para cancelamento da fatura.');
      return;
    }

    await handleCancel(cancelInvoiceId, cancelReason.trim());
    setCancelInvoiceId(null);
    setCancelReason('');
  };

  const handleInitiatePayment = async (invoiceId: string) => {
    setActionLoading(`pay-${invoiceId}`);
    setActionError('');
    try {
      const res = await invoicesApi.initiatePayment(invoiceId);
      window.open(res.data.paymentUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setActionError('Erro ao iniciar pagamento. Verifica a configuração do Stripe.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateDue = async () => {
    setConfirmGenerateDue(true);
  };

  const confirmGenerateDueAction = async () => {
    setConfirmGenerateDue(false);
    setGeneratingInvoices(true);
    try {
      const res = await invoicesApi.generateDue();
      toastSuccess(res.data.message);
      if (selectedCondoId) await loadInvoices(selectedCondoId);
    } catch {
      toastError('Erro ao gerar faturas.');
    } finally {
      setGeneratingInvoices(false);
    }
  };

  const invoiceColumns: Column<InvoiceDto>[] = [
    {
      key: 'invoiceRef',
      header: 'Referência',
      mobileLabel: 'Referência',
      render: (inv) => <span className="font-mono text-xs font-medium text-ink">{inv.invoiceRef}</span>,
    },
    {
      key: 'issuedDate',
      header: 'Data',
      mobileLabel: 'Data',
      render: (inv) => <span className="text-ink-muted">{new Date(inv.issuedDate).toLocaleDateString('pt-PT')}</span>,
    },
    {
      key: 'dueDate',
      header: 'Vencimento',
      mobileLabel: 'Vencimento',
      render: (inv) => (
        <span className={inv.isOverdue ? 'text-red-600 font-medium' : 'text-ink-muted'}>
          {new Date(inv.dueDate).toLocaleDateString('pt-PT')}
        </span>
      ),
    },
    {
      key: 'planName',
      header: 'Plano',
      mobileLabel: 'Plano',
      render: (inv) => <span className="text-ink-muted">{inv.planName}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      align: 'right',
      mobileLabel: 'Total',
      render: (inv) => <span className="font-semibold text-ink">{fmt(inv.totalAmount)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      mobileLabel: 'Estado',
      render: (inv) => <StatusBadge status={inv.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      mobileLabel: 'Ações',
      render: (inv) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          {inv.pdfUrl && (
            <button
              onClick={() => invoicesApi.downloadPdf(inv.id)}
              className="p-1.5 rounded hover:bg-surface-hover text-ink-subtle hover:text-ink"
              title="Descarregar PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {(inv.status === 'Emitted' || inv.status === 'Overdue') && (
            <>
              <button
                onClick={() => handleMarkPaid(inv.id)}
                disabled={actionLoading === inv.id}
                className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
                title="Marcar como paga"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleInitiatePayment(inv.id)}
                disabled={actionLoading === `pay-${inv.id}`}
                className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 disabled:opacity-50"
                title="Pagar via gateway"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={() => openCancelModal(inv.id)}
                disabled={actionLoading === inv.id}
                className="p-1.5 rounded hover:bg-red-50 text-red-500 disabled:opacity-50"
                title="Cancelar fatura"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <ConfirmModal
        open={confirmGenerateDue}
        title="Gerar faturas em dívida"
        message="Gerar faturas para todas as subscrições com cobrança em atraso?"
        confirmLabel="Gerar"
        variant="warning"
        onConfirm={confirmGenerateDueAction}
        onCancel={() => setConfirmGenerateDue(false)}
      />
      <ConfirmModal
        open={cancelInvoiceId !== null}
        title="Cancelar fatura"
        message="Esta ação vai cancelar a fatura selecionada."
        confirmLabel="Confirmar cancelamento"
        variant="danger"
        onConfirm={confirmCancelInvoice}
        onCancel={() => {
          setCancelInvoiceId(null);
          setCancelReason('');
        }}
      />

      {cancelInvoiceId !== null && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
          <label className="block text-sm font-medium text-red-900">Motivo para cancelamento</label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            placeholder="Explique o motivo do cancelamento..."
          />
          <p className="text-xs text-red-700">O motivo sera registado na fatura.</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          Faturas
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateDue}
            disabled={generatingInvoices}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-line text-sm text-ink-muted hover:bg-surface-hover transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${generatingInvoices ? 'animate-spin' : ''}`} />
            {generatingInvoices ? 'A gerar...' : 'Gerar Em Dívida'}
          </button>
          <button
            onClick={() => invoicesApi.downloadSaftXml(selectedCondoId, Number(saftYear), `SAFT-PT_${selectedCondoId}_${saftYear}.xml`)}
            disabled={!selectedCondoId}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            SAF-T {saftYear}
          </button>
          <input
            type="number"
            value={saftYear}
            min={2020}
            max={new Date().getFullYear() + 1}
            onChange={(e) => setSaftYear(e.target.value)}
            className="w-20 px-2 py-1.5 border border-line rounded-lg text-sm text-center"
          />
        </div>
      </div>

      {/* Condominium selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-ink-subtle" />
          <select
            value={selectedCondoId}
            onChange={(e) => setSelectedCondoId(e.target.value)}
            className="border border-line rounded-lg px-3 py-1.5 text-sm bg-surface"
          >
            {condominiums.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-line rounded-lg px-3 py-1.5 text-sm bg-surface"
        >
          <option value="all">Todos os estados</option>
          <option value="Emitted">Emitidas</option>
          <option value="Paid">Pagas</option>
          <option value="Overdue">Vencidas</option>
          <option value="Cancelled">Canceladas</option>
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="border border-line rounded-lg px-3 py-1.5 text-sm bg-surface"
        >
          <option value="all">Todos os anos</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Stats mini bar */}
      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Emitido', value: fmt(totalEmitted), color: 'text-blue-700 bg-blue-50 border-blue-200' },
            { label: 'Cobrado', value: fmt(totalPaid), color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { label: 'Em Dívida', value: fmt(totalOverdue), color: 'text-red-700 bg-red-50 border-red-200' },
            { label: 'Vencidas', value: String(overdueCount), color: overdueCount > 0 ? 'text-red-700 bg-red-50 border-red-200' : 'text-ink-muted bg-surface-muted border-line' },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg border px-3 py-2 text-sm ${s.color}`}>
              <p className="text-xs opacity-70">{s.label}</p>
              <p className="font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {/* Invoice table */}
      <DataTable<InvoiceDto>
        columns={invoiceColumns}
        rows={filtered}
        rowKey={(inv) => inv.id}
        loading={loading}
        error={error || null}
        onRetry={() => { if (selectedCondoId) loadInvoices(selectedCondoId); }}
        onRowClick={(inv) => setSelectedInvoice(inv)}
        emptyState={
          <EmptyState
            icon={FileText}
            title="Nenhuma fatura encontrada para os filtros selecionados."
          />
        }
      />

      {/* Invoice detail modal */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="bg-surface rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink">{selectedInvoice.invoiceRef}</h3>
                <p className="text-sm text-ink-subtle">{selectedInvoice.customerName}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded text-ink-subtle hover:text-ink-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-ink-subtle uppercase">Estado</p>
                <StatusBadge status={selectedInvoice.status} />
              </div>
              <div>
                <p className="text-xs text-ink-subtle uppercase">Plano</p>
                <p className="font-medium text-ink">{selectedInvoice.planName}</p>
              </div>
              <div>
                <p className="text-xs text-ink-subtle uppercase">Emitida</p>
                <p className="text-ink-muted">{new Date(selectedInvoice.issuedDate).toLocaleDateString('pt-PT')}</p>
              </div>
              <div>
                <p className="text-xs text-ink-subtle uppercase">Vencimento</p>
                <p className={selectedInvoice.isOverdue ? 'text-red-600 font-semibold' : 'text-ink-muted'}>
                  {new Date(selectedInvoice.dueDate).toLocaleDateString('pt-PT')}
                </p>
              </div>
              {selectedInvoice.paidDate && (
                <div>
                  <p className="text-xs text-ink-subtle uppercase">Data de Pagamento</p>
                  <p className="text-emerald-700">{new Date(selectedInvoice.paidDate).toLocaleDateString('pt-PT')}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-ink-subtle uppercase">Período</p>
                <p className="text-ink-muted">
                  {new Date(selectedInvoice.periodStartDate).toLocaleDateString('pt-PT')} –{' '}
                  {new Date(selectedInvoice.periodEndDate).toLocaleDateString('pt-PT')}
                </p>
              </div>
            </div>

            <div className="border-t border-line pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>Subtotal</span>
                <span>{fmt(selectedInvoice.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>IVA ({(selectedInvoice.vatRate * 100).toFixed(0)}%)</span>
                <span>{fmt(selectedInvoice.vatAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-ink text-base border-t border-line pt-1 mt-1">
                <span>Total</span>
                <span>{fmt(selectedInvoice.totalAmount)}</span>
              </div>
            </div>

            {selectedInvoice.cancellationReason && (
              <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                Motivo de cancelamento: {selectedInvoice.cancellationReason}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {selectedInvoice.pdfUrl && (
                <a
                  href={selectedInvoice.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Descarregar PDF
                </a>
              )}
              {(selectedInvoice.status === 'Emitted' || selectedInvoice.status === 'Overdue') && (
                <>
                  <Button
                    variant="success"
                    icon={CheckCircle2}
                    onClick={() => handleMarkPaid(selectedInvoice.id)}
                    loading={actionLoading === selectedInvoice.id}
                  >
                    Marcar Paga
                  </Button>
                  <Button
                    variant="ghost"
                    icon={ExternalLink}
                    onClick={() => handleInitiatePayment(selectedInvoice.id)}
                    loading={actionLoading === `pay-${selectedInvoice.id}`}
                    className="border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                  >
                    Pagar via Stripe
                  </Button>
                  <Button
                    variant="ghost"
                    icon={XCircle}
                    onClick={() => openCancelModal(selectedInvoice.id)}
                    disabled={actionLoading === selectedInvoice.id}
                    className="border border-red-300 bg-red-50 hover:bg-red-100 text-red-600"
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>

            {actionError && <p className="text-xs text-red-600">{actionError}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function PlanCard({
  plan,
  onAssign,
  onEdit,
}: {
  plan: SubscriptionPlanDto;
  onAssign: (plan: SubscriptionPlanDto) => void;
  onEdit: (plan: SubscriptionPlanDto) => void;
}) {
  const meta = tierMeta[plan.tier] ?? tierMeta.Free;
  const Icon = meta.icon;

  return (
    <div className={`rounded-xl border-2 p-5 flex flex-col gap-4 ${meta.color}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
          {plan.tier}
        </span>
        <Icon className="w-5 h-5 text-ink-subtle" />
      </div>

      <div>
        <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
        <p className="text-xs text-ink-subtle mt-0.5">{plan.description}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-ink">{fmt(plan.priceMonthly)}</span>
          <span className="text-xs text-ink-subtle">/mês</span>
        </div>
        {plan.priceAnnual > 0 && (
          <div className="text-xs text-ink-subtle">
            {fmt(plan.priceAnnual)}/ano{' '}
            {formatDiscount(plan.annualDiscountPercent) && (
              <span className="text-emerald-600 font-medium">{formatDiscount(plan.annualDiscountPercent)}</span>
            )}
          </div>
        )}
        {plan.priceQuinquennial > 0 && (
          <div className="text-xs text-ink-subtle">
            {fmt(plan.priceQuinquennial)}/5 anos{' '}
            {formatDiscount(plan.quinquennialDiscountPercent) && (
              <span className="text-emerald-600 font-medium">{formatDiscount(plan.quinquennialDiscountPercent)}</span>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-1.5 flex-1">
        {plan.features.filter((f) => f.isEnabled).map((f) => (
          <li key={f.featureKey} className="flex items-center gap-2 text-sm text-ink-muted">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            {f.featureLabel}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex gap-2">
        <Button variant="ghost" onClick={() => onEdit(plan)} fullWidth className="flex-1 border border-line">
          Editar
        </Button>
        <Button onClick={() => onAssign(plan)} fullWidth className="flex-1">
          Atribuir
        </Button>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const [confirmResetPlans, setConfirmResetPlans] = useState(false);
  const [cancelSubId, setCancelSubId] = useState<string | null>(null);

  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [featureCatalog, setFeatureCatalog] = useState<FeatureCatalogItemDto[]>([]);
  const [subscriptions, setSubscriptions] = useState<CondominiumSubscriptionDto[]>([]);
  const [condominiums, setCondominiums] = useState<CondominiumDto[]>([]);
  const [monthlyVolume, setMonthlyVolume] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [plansError, setPlansError] = useState('');

  // Assign modal state
  const [assignModal, setAssignModal] = useState<{
    plan: SubscriptionPlanDto;
    condominiumId: string;
    billingCycle: string;
  } | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState<PlanFormState>(emptyPlanForm());
  const [savingPlan, setSavingPlan] = useState(false);
  const [planFormError, setPlanFormError] = useState('');
  const [resettingPlans, setResettingPlans] = useState(false);

  useEffect(() => {
    if (!isManager) navigate('/dashboard');
  }, [isManager, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, catalogRes, subsRes, condosRes, statsRes] = await Promise.all([
        subscriptionsApi.getPlans(),
        subscriptionsApi.getFeatureCatalog(),
        subscriptionsApi.getAll(),
        condominiumsApi.getAll(),
        subscriptionsApi.getStats(),
      ]);
      setPlans(plansRes.data);
      setFeatureCatalog(catalogRes.data);
      setSubscriptions(subsRes.data);
      setCondominiums(condosRes.data);
      setMonthlyVolume(statsRes.data.monthlyBillingVolume);
      setPlansError('');
    } catch {
      setPlansError('Não foi possível carregar a gestão de planos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreatePlanModal = () => {
    const base = emptyPlanForm();
    const defaultFeatures = featureCatalog.reduce<Record<string, boolean>>((acc, f) => {
      acc[f.featureKey] = false;
      return acc;
    }, {});
    setPlanForm({ ...base, features: defaultFeatures });
    setPlanFormError('');
    setPlanModalOpen(true);
  };

  const openEditPlanModal = (plan: SubscriptionPlanDto) => {
    const defaults = featureCatalog.reduce<Record<string, boolean>>((acc, f) => {
      acc[f.featureKey] = false;
      return acc;
    }, {});
    for (const feature of plan.features) {
      defaults[feature.featureKey] = feature.isEnabled;
    }

    setPlanForm({
      id: plan.id,
      name: plan.name,
      tier: plan.tier,
      description: plan.description,
      priceMonthly: plan.priceMonthly,
      annualDiscountPercent: plan.annualDiscountPercent,
      quinquennialDiscountPercent: plan.quinquennialDiscountPercent,
      isActive: plan.isActive,
      features: defaults,
    });
    setPlanFormError('');
    setPlanModalOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) {
      setPlanFormError('O nome do plano é obrigatório.');
      return;
    }

    if (planForm.priceMonthly < 0 || planForm.annualDiscountPercent < 0 || planForm.quinquennialDiscountPercent < 0) {
      setPlanFormError('Preço e descontos não podem ser negativos.');
      return;
    }

    if (planForm.annualDiscountPercent > 100 || planForm.quinquennialDiscountPercent > 100) {
      setPlanFormError('Os descontos têm de estar entre 0% e 100%.');
      return;
    }

    if (!Object.values(planForm.features).some(Boolean)) {
      setPlanFormError('Ativa pelo menos uma funcionalidade no plano.');
      return;
    }

    const features = featureCatalog.map((item) => ({
      featureKey: item.featureKey,
      isEnabled: !!planForm.features[item.featureKey],
    }));

    const payload: CreateSubscriptionPlanRequest | UpdateSubscriptionPlanRequest = {
      name: planForm.name,
      tier: planForm.tier,
      description: planForm.description,
      priceMonthly: planForm.priceMonthly,
      annualDiscountPercent: planForm.annualDiscountPercent,
      quinquennialDiscountPercent: planForm.quinquennialDiscountPercent,
      isActive: planForm.isActive,
      features,
    };

    try {
      setSavingPlan(true);
      setPlanFormError('');
      setPlansError('');
      if (planForm.id) {
        await subscriptionsApi.updatePlan(planForm.id, payload as UpdateSubscriptionPlanRequest);
      } else {
        await subscriptionsApi.createPlan(payload as CreateSubscriptionPlanRequest);
      }
      setPlanModalOpen(false);
      await load();
    } catch {
      setPlanFormError('Erro ao guardar plano. Verifica os valores e tenta novamente.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleResetDefaultPlans = async () => {
    setConfirmResetPlans(true);
  };

  const confirmResetPlansAction = async () => {
    setConfirmResetPlans(false);
    try {
      setResettingPlans(true);
      setPlansError('');
      await subscriptionsApi.resetDefaultPlans();
      await load();
    } catch {
      setPlansError('Não foi possível repor os planos padrão.');
    } finally {
      setResettingPlans(false);
    }
  };

  const handleAssign = async () => {
    if (!assignModal || !assignModal.condominiumId) {
      setAssignError('Seleciona um condomínio.');
      return;
    }
    setAssigning(true);
    setAssignError('');
    try {
      const req: AssignSubscriptionRequest = {
        condominiumId: assignModal.condominiumId,
        planId: assignModal.plan.id,
        billingCycle: assignModal.billingCycle,
      };
      await subscriptionsApi.assign(req);
      setAssignModal(null);
      await load();
    } catch {
      setAssignError('Erro ao atribuir subscrição. Verifica os dados e tenta novamente.');
    } finally {
      setAssigning(false);
    }
  };

  const handleCancel = async (subId: string) => {
    setCancelSubId(subId);
  };

  const confirmCancelSub = async () => {
    if (!cancelSubId) return;
    try {
      await subscriptionsApi.cancel(cancelSubId);
      await load();
    } catch {
      toastError('Erro ao cancelar subscrição.');
    } finally {
      setCancelSubId(null);
    }
  };

  const activeSubMap = new Map(subscriptions.map((s) => [s.condominiumId, s]));
  const activeCount = subscriptions.length;
  const previewAnnual = calculateDiscountedPrice(planForm.priceMonthly, 12, planForm.annualDiscountPercent);
  const previewQuinquennial = calculateDiscountedPrice(planForm.priceMonthly, 60, planForm.quinquennialDiscountPercent);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton variant="card" rows={3} />
        <Skeleton variant="list" rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ConfirmModal
        open={confirmResetPlans}
        title="Repor planos padrão"
        message="Isto irá repor os planos Free/Silver/Gold para os valores padrão. Pretendes continuar?"
        confirmLabel="Repor"
        variant="warning"
        onConfirm={confirmResetPlansAction}
        onCancel={() => setConfirmResetPlans(false)}
      />
      <ConfirmModal
        open={cancelSubId !== null}
        title="Cancelar subscrição"
        message="Tem a certeza que deseja cancelar esta subscrição?"
        confirmLabel="Cancelar subscrição"
        variant="danger"
        onConfirm={confirmCancelSub}
        onCancel={() => setCancelSubId(null)}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            Faturação e Subscrições
          </h1>
          <p className="text-ink-subtle mt-1 text-sm">
            Gere os planos e subscrições dos condomínios da plataforma.
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Condomínios"
          value={condominiums.length}
          icon={Building2}
          color="bg-indigo-100 text-indigo-700"
        />
        <StatCard
          title="Subscrições Ativas"
          value={activeCount}
          icon={Check}
          color="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          title="Volume Mensal (MRR)"
          value={monthlyVolume !== null ? fmt(monthlyVolume) : '—'}
          icon={CreditCard}
          color="bg-amber-100 text-amber-700"
        />
      </div>

      {/* Plans */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-ink">Planos Disponíveis</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaultPlans}
              disabled={resettingPlans}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors disabled:opacity-60"
            >
              {resettingPlans ? 'A repor...' : 'Repor Padrão'}
            </button>
            <button
              onClick={openCreatePlanModal}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-surface text-sm font-medium hover:opacity-90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Plano
            </button>
          </div>
        </div>
        {plansError && (
          <p className="mb-3 text-sm text-red-600">{plansError}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={openEditPlanModal}
              onAssign={(p) =>
                setAssignModal({
                  plan: p,
                  condominiumId: condominiums[0]?.id ?? '',
                  billingCycle: p.priceMonthly > 0 ? 'Monthly' : 'Monthly',
                })
              }
            />
          ))}
        </div>
      </section>

      {/* Subscriptions table */}
      <section>
        <h2 className="text-base font-semibold text-ink mb-3">Subscrições Ativas</h2>
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-subtle uppercase bg-surface-muted border-b border-line">
                <th className="px-4 py-3">Condomínio</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Ciclo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Próxima Cobrança</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {condominiums.map((condo) => {
                const sub = activeSubMap.get(condo.id);
                return (
                  <tr key={condo.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-medium text-ink">{condo.name}</td>
                    <td className="px-4 py-3">
                      {sub ? (
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            tierMeta[sub.plan.tier]?.badge ?? 'bg-control text-ink-muted'
                          }`}
                        >
                          {sub.plan.name}
                        </span>
                      ) : (
                        <span className="text-ink-subtle text-xs">Sem plano</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {sub ? cycleLabel[sub.billingCycle] ?? sub.billingCycle : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {sub ? fmt(sub.priceAtPurchase) : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {sub
                        ? new Date(sub.nextBillingDate).toLocaleDateString('pt-PT')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2 justify-end">
                      <button
                        onClick={() =>
                          setAssignModal({
                            plan: plans[0] ?? sub?.plan ?? plans[0],
                            condominiumId: condo.id,
                            billingCycle: 'Monthly',
                          })
                        }
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        {sub ? 'Alterar' : 'Atribuir'}
                      </button>
                      {sub && (
                        <button
                          onClick={() => handleCancel(sub.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {condominiums.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-subtle text-sm">
                    Nenhum condomínio encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink">Atribuir Subscrição</h3>
              <button onClick={() => setAssignModal(null)}>
                <X className="w-5 h-5 text-ink-subtle hover:text-ink-muted" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Condominium select */}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Condomínio
                </label>
                <div className="relative">
                  <select
                    value={assignModal.condominiumId}
                    onChange={(e) =>
                      setAssignModal({ ...assignModal, condominiumId: e.target.value })
                    }
                    className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2 text-sm pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {condominiums.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-ink-subtle pointer-events-none" />
                </div>
              </div>

              {/* Plan select */}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Plano
                </label>
                <div className="relative">
                  <select
                    value={assignModal.plan.id}
                    onChange={(e) => {
                      const p = plans.find((x) => x.id === e.target.value);
                      if (p) setAssignModal({ ...assignModal, plan: p });
                    }}
                    className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2 text-sm pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-ink-subtle pointer-events-none" />
                </div>
              </div>

              {/* Billing cycle */}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Ciclo de Faturação
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Monthly', 'Annual', 'Quinquennial'] as const).map((cycle) => {
                    const price =
                      cycle === 'Monthly'
                        ? assignModal.plan.priceMonthly
                        : cycle === 'Annual'
                        ? assignModal.plan.priceAnnual
                        : assignModal.plan.priceQuinquennial;
                    const isSelected = assignModal.billingCycle === cycle;
                    return (
                      <button
                        key={cycle}
                        onClick={() => setAssignModal({ ...assignModal, billingCycle: cycle })}
                        className={`border rounded-lg p-2 text-xs text-center transition-colors ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                            : 'border-line text-ink-muted hover:border-ink-subtle'
                        }`}
                      >
                        <div className="font-medium">{cycleLabel[cycle]}</div>
                        <div className="mt-0.5">{fmt(price)}</div>
                        {cycle === 'Annual' && assignModal.plan.annualDiscountPercent > 0 && (
                          <div className="text-emerald-600 font-medium">-{assignModal.plan.annualDiscountPercent.toFixed(0)}%</div>
                        )}
                        {cycle === 'Quinquennial' && assignModal.plan.quinquennialDiscountPercent > 0 && (
                          <div className="text-emerald-600 font-medium">-{assignModal.plan.quinquennialDiscountPercent.toFixed(0)}%</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {assignError && (
                <p className="text-sm text-red-600">{assignError}</p>
              )}

              <Button
                onClick={handleAssign}
                loading={assigning}
                fullWidth
              >
                Confirmar Atribuição
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Plan editor modal */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-3xl p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                {planForm.id ? 'Editar Plano' : 'Criar Plano'}
              </h3>
              <button onClick={() => setPlanModalOpen(false)}>
                <X className="w-5 h-5 text-ink-subtle hover:text-ink-muted" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">Nome</label>
                <input
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Silver Plus"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">Tier</label>
                <select
                  value={planForm.tier}
                  onChange={(e) => setPlanForm({ ...planForm, tier: e.target.value })}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2 text-sm"
                >
                  <option value="Free">Free</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-muted mb-1">Descrição</label>
                <textarea
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">Preço Mensal (EUR)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={planForm.priceMonthly}
                  onChange={(e) => setPlanForm({ ...planForm, priceMonthly: Number(e.target.value) })}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">Desconto Anual (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={planForm.annualDiscountPercent}
                  onChange={(e) => setPlanForm({ ...planForm, annualDiscountPercent: Number(e.target.value) })}
                  className={`w-full border bg-surface text-ink rounded-lg px-3 py-2 text-sm ${planForm.annualDiscountPercent > 100 ? 'border-red-300 bg-red-50' : 'border-line'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">Desconto 5 Anos (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={planForm.quinquennialDiscountPercent}
                  onChange={(e) => setPlanForm({ ...planForm, quinquennialDiscountPercent: Number(e.target.value) })}
                  className={`w-full border bg-surface text-ink rounded-lg px-3 py-2 text-sm ${planForm.quinquennialDiscountPercent > 100 ? 'border-red-300 bg-red-50' : 'border-line'}`}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="plan-is-active"
                  type="checkbox"
                  checked={planForm.isActive}
                  onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                />
                <label htmlFor="plan-is-active" className="text-sm text-ink-muted">Plano ativo</label>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-sm font-medium text-indigo-900 mb-1">Pré-visualização de Preços</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-indigo-800">
                <div>Mensal: <span className="font-semibold">{fmt(roundMoney(planForm.priceMonthly || 0))}</span></div>
                <div>Anual: <span className="font-semibold">{fmt(previewAnnual)}</span></div>
                <div>5 Anos: <span className="font-semibold">{fmt(previewQuinquennial)}</span></div>
              </div>
            </div>

            <div className="border border-line rounded-lg p-4">
              <h4 className="font-medium text-ink mb-3">Funcionalidades do Plano</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {featureCatalog.map((feature) => (
                  <label key={feature.featureKey} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 text-sm">
                    <span>{feature.featureLabel}</span>
                    <input
                      type="checkbox"
                      checked={!!planForm.features[feature.featureKey]}
                      onChange={(e) => setPlanForm({
                        ...planForm,
                        features: {
                          ...planForm.features,
                          [feature.featureKey]: e.target.checked,
                        },
                      })}
                    />
                  </label>
                ))}
              </div>
            </div>

            {planFormError && (
              <p className="mt-3 text-sm text-red-600">{planFormError}</p>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPlanModalOpen(false);
                  setPlanFormError('');
                }}
                className="border border-line"
              >
                Cancelar
              </Button>
              <Button onClick={handleSavePlan} loading={savingPlan}>
                Guardar Plano
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invoices dashboard */}
      {condominiums.length > 0 && (
        <div className="border-t border-line pt-8">
          <InvoicesDashboard condominiums={condominiums} />
        </div>
      )}
    </div>
  );
}

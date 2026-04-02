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
} from 'lucide-react';
import { subscriptionsApi, condominiumsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type {
  SubscriptionPlanDto,
  CondominiumSubscriptionDto,
  CondominiumDto,
  AssignSubscriptionRequest,
} from '../types';

const tierMeta: Record<string, { icon: React.ElementType; color: string; badge: string }> = {
  Free:   { icon: Layers,     color: 'border-gray-200 bg-gray-50',          badge: 'bg-gray-100 text-gray-600' },
  Silver: { icon: Shield,     color: 'border-amber-300 bg-amber-50',        badge: 'bg-amber-100 text-amber-700' },
  Gold:   { icon: TrendingUp, color: 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300', badge: 'bg-emerald-100 text-emerald-700' },
};

const cycleLabel: Record<string, string> = {
  Monthly: 'Mensal',
  Annual: 'Anual',
  Quinquennial: '5 Anos',
};

const cycleDiscount: Record<string, string> = {
  Annual: '−17%',
  Quinquennial: '−30%',
};

function fmt(value: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
}

function PlanCard({
  plan,
  onAssign,
}: {
  plan: SubscriptionPlanDto;
  onAssign: (plan: SubscriptionPlanDto) => void;
}) {
  const meta = tierMeta[plan.tier] ?? tierMeta.Free;
  const Icon = meta.icon;

  return (
    <div className={`rounded-xl border-2 p-5 flex flex-col gap-4 ${meta.color}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
          {plan.tier}
        </span>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900">{fmt(plan.priceMonthly)}</span>
          <span className="text-xs text-gray-400">/mês</span>
        </div>
        {plan.priceAnnual > 0 && (
          <div className="text-xs text-gray-500">
            {fmt(plan.priceAnnual)}/ano{' '}
            <span className="text-emerald-600 font-medium">{cycleDiscount.Annual}</span>
          </div>
        )}
        {plan.priceQuinquennial > 0 && (
          <div className="text-xs text-gray-500">
            {fmt(plan.priceQuinquennial)}/5 anos{' '}
            <span className="text-emerald-600 font-medium">{cycleDiscount.Quinquennial}</span>
          </div>
        )}
      </div>

      <ul className="space-y-1.5 flex-1">
        {plan.features.map((f) => (
          <li key={f.featureKey} className="flex items-center gap-2 text-sm text-gray-700">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            {f.featureLabel}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onAssign(plan)}
        className="mt-auto w-full py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        Atribuir a Condomínio
      </button>
    </div>
  );
}

export default function BillingPage() {
  const { isManager } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [subscriptions, setSubscriptions] = useState<CondominiumSubscriptionDto[]>([]);
  const [condominiums, setCondominiums] = useState<CondominiumDto[]>([]);
  const [monthlyVolume, setMonthlyVolume] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Assign modal state
  const [assignModal, setAssignModal] = useState<{
    plan: SubscriptionPlanDto;
    condominiumId: string;
    billingCycle: string;
  } | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    if (!isManager) navigate('/dashboard');
  }, [isManager, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, subsRes, condosRes, statsRes] = await Promise.all([
        subscriptionsApi.getPlans(),
        subscriptionsApi.getAll(),
        condominiumsApi.getAll(),
        subscriptionsApi.getStats(),
      ]);
      setPlans(plansRes.data);
      setSubscriptions(subsRes.data);
      setCondominiums(condosRes.data);
      setMonthlyVolume(statsRes.data.monthlyBillingVolume);
    } catch {
      // handled by fallback UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
    if (!confirm('Cancelar esta subscrição?')) return;
    try {
      await subscriptionsApi.cancel(subId);
      await load();
    } catch {
      alert('Erro ao cancelar subscrição.');
    }
  };

  const activeSubMap = new Map(subscriptions.map((s) => [s.condominiumId, s]));
  const activeCount = subscriptions.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" /> A carregar...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            Faturação e Subscrições
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Gere os planos e subscrições dos condomínios da plataforma.
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
          <span className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
            <Building2 className="w-5 h-5" />
          </span>
          <div>
            <p className="text-xs text-gray-500">Condomínios</p>
            <p className="text-xl font-bold text-gray-900">{condominiums.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
          <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <Check className="w-5 h-5" />
          </span>
          <div>
            <p className="text-xs text-gray-500">Subscrições Ativas</p>
            <p className="text-xl font-bold text-gray-900">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
          <span className="p-2 rounded-lg bg-amber-100 text-amber-700">
            <CreditCard className="w-5 h-5" />
          </span>
          <div>
            <p className="text-xs text-gray-500">Volume Mensal (MRR)</p>
            <p className="text-xl font-bold text-gray-900">
              {monthlyVolume !== null ? fmt(monthlyVolume) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Planos Disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
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
        <h2 className="text-base font-semibold text-gray-900 mb-3">Subscrições Ativas</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3">Condomínio</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Ciclo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Próxima Cobrança</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {condominiums.map((condo) => {
                const sub = activeSubMap.get(condo.id);
                return (
                  <tr key={condo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{condo.name}</td>
                    <td className="px-4 py-3">
                      {sub ? (
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            tierMeta[sub.plan.tier]?.badge ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {sub.plan.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Sem plano</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sub ? cycleLabel[sub.billingCycle] ?? sub.billingCycle : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sub ? fmt(sub.priceAtPurchase) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
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
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Nenhum condomínio encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Atribuir Subscrição</h3>
              <button onClick={() => setAssignModal(null)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-700" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Condominium select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condomínio
                </label>
                <div className="relative">
                  <select
                    value={assignModal.condominiumId}
                    onChange={(e) =>
                      setAssignModal({ ...assignModal, condominiumId: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {condominiums.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Plan select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plano
                </label>
                <div className="relative">
                  <select
                    value={assignModal.plan.id}
                    onChange={(e) => {
                      const p = plans.find((x) => x.id === e.target.value);
                      if (p) setAssignModal({ ...assignModal, plan: p });
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Billing cycle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium">{cycleLabel[cycle]}</div>
                        <div className="mt-0.5">{fmt(price)}</div>
                        {cycleDiscount[cycle] && (
                          <div className="text-emerald-600 font-medium">{cycleDiscount[cycle]}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {assignError && (
                <p className="text-sm text-red-600">{assignError}</p>
              )}

              <button
                onClick={handleAssign}
                disabled={assigning}
                className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {assigning ? 'A guardar...' : 'Confirmar Atribuição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Building2, Home, Check, Star } from 'lucide-react';
import { meApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/I18nProvider';
import type { MembershipCondominiumDto } from '../types';
import { AsyncState, EmptyState, Button, Badge } from '../components/ui';

export default function SelectContextPage() {
  const navigate = useNavigate();
  const { user, switchContext } = useAuth();
  const { t } = useTranslation();
  const [condominiums, setCondominiums] = useState<MembershipCondominiumDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCondoId, setSelectedCondoId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Applies the chosen context and, on success, proceeds to the dashboard.
  const applyContext = useCallback(
    async (condominiumId: string, unitId: string | null) => {
      setConfirming(true);
      setError('');
      try {
        await switchContext(condominiumId, unitId);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('selectContext.errorSwitch'));
        setConfirming(false);
      }
    },
    [switchContext, navigate, t],
  );

  // Loads memberships on mount (and on retry via reloadKey). setState only runs
  // inside the async .then/.catch callbacks, so no synchronous effect setState.
  useEffect(() => {
    meApi.getMemberships()
      .then(async (r) => {
        const data = r.data;
        const condos = data.condominiums ?? [];
        const totalUnits = condos.reduce((sum, c) => sum + c.units.length, 0);

        // SKIP behavior: a single membership needs no choice — auto-select it.
        if (condos.length === 1 && totalUnits === 1) {
          setLoading(false);
          await applyContext(condos[0].condominiumId, condos[0].units[0]?.unitId ?? null);
          return;
        }

        const active = data.activeContext;
        const preselectCondo = active?.condominiumId ?? condos[0]?.condominiumId ?? null;
        const preselectCondoObj = condos.find((c) => c.condominiumId === preselectCondo);
        const preselectUnit =
          active?.unitId ??
          preselectCondoObj?.units.find((u) => u.isPrimary)?.unitId ??
          preselectCondoObj?.units[0]?.unitId ??
          null;

        setError('');
        setCondominiums(condos);
        setSelectedCondoId(preselectCondo);
        setSelectedUnitId(preselectUnit);
        setLoading(false);
      })
      .catch(() => {
        setError(t('selectContext.errorLoad'));
        setLoading(false);
      });
  }, [applyContext, reloadKey, t]);

  if (!user) return <Navigate to="/login" replace />;

  const handleRetry = () => {
    setError('');
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const handleSelectCondo = (condo: MembershipCondominiumDto) => {
    setSelectedCondoId(condo.condominiumId);
    const primary = condo.units.find((u) => u.isPrimary) ?? condo.units[0];
    setSelectedUnitId(primary?.unitId ?? null);
  };

  const selectedCondo = condominiums.find((c) => c.condominiumId === selectedCondoId);
  const needsUnit = (selectedCondo?.units.length ?? 0) > 1;
  const canConfirm =
    !!selectedCondoId && (!needsUnit || !!selectedUnitId) && !confirming;

  const handleConfirm = () => {
    if (!selectedCondoId) return;
    applyContext(selectedCondoId, selectedUnitId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ink">Habitus</h1>
          <p className="text-ink-subtle mt-1">{t('common.appTagline')}</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-ink mb-2">{t('selectContext.title')}</h2>
          <p className="text-sm text-ink-subtle mb-6">
            {t('selectContext.subtitle')}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
          )}

          <AsyncState
            loading={loading}
            isEmpty={condominiums.length === 0}
            onRetry={handleRetry}
            skeleton="list"
            skeletonRows={3}
            empty={
              <EmptyState
                icon={Building2}
                title={t('selectContext.emptyTitle')}
                description={t('selectContext.emptyDescription')}
              />
            }
          >
            <div className="space-y-3 max-h-96 overflow-y-auto app-scrollbar pr-1">
              {condominiums.map((condo) => {
                const isSelectedCondo = condo.condominiumId === selectedCondoId;
                return (
                  <div
                    key={condo.condominiumId}
                    className={`rounded-xl border transition-colors ${
                      isSelectedCondo
                        ? 'border-indigo-500 ring-1 ring-indigo-500'
                        : 'border-line'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectCondo(condo)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {condo.condominiumName}
                        </p>
                        <p className="text-xs text-ink-subtle">
                          {condo.units.length}{' '}
                          {condo.units.length === 1 ? t('selectContext.unitSingular') : t('selectContext.unitPlural')}
                        </p>
                      </div>
                      {isSelectedCondo && !needsUnit && (
                        <Check className="w-5 h-5 text-indigo-600 shrink-0" />
                      )}
                    </button>

                    {isSelectedCondo && condo.units.length > 1 && (
                      <div className="px-4 pb-3 pt-1 space-y-2 border-t border-line">
                        <p className="text-xs font-medium text-ink-subtle pt-2">
                          {t('selectContext.chooseFraction')}
                        </p>
                        {condo.units.map((unit) => {
                          const isSelectedUnit = unit.unitId === selectedUnitId;
                          return (
                            <button
                              key={unit.unitId}
                              type="button"
                              onClick={() => setSelectedUnitId(unit.unitId)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                isSelectedUnit
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'text-ink-muted hover:bg-surface-hover'
                              }`}
                            >
                              <Home className="w-4 h-4 shrink-0" />
                              <span className="text-sm font-medium flex-1">
                                {t('common.fraction', { number: unit.unitNumber })}
                              </span>
                              {unit.isPrimary && (
                                <Badge variant="brand" icon={Star}>
                                  {t('selectContext.primary')}
                                </Badge>
                              )}
                              {isSelectedUnit && (
                                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <Button onClick={handleConfirm} loading={confirming} disabled={!canConfirm} fullWidth>
                {confirming ? t('selectContext.confirming') : t('selectContext.continue')}
              </Button>
            </div>
          </AsyncState>
        </div>
      </div>
    </div>
  );
}

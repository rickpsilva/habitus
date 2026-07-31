import { useCallback, useEffect, useState } from 'react';
import { Users, Trash2, Mail, Phone, Home } from 'lucide-react';
import { residentsApi, unitsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import type { ResidentDto, UnitDto } from '../types';
import { PageHeader, AsyncState, EmptyState, Card } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';

const roleLabels = (t: TranslateFn): Record<string, string> => ({
  Admin: t('role.admin'),
  Resident: t('role.resident'),
  Manager: t('role.manager'),
});

const roleColors: Record<string, string> = {
  Admin: 'bg-indigo-100 text-indigo-700',
  Resident: 'bg-control text-ink-muted',
  Manager: 'bg-emerald-100 text-emerald-700',
};

export default function ResidentsPage() {
  const { isAdmin, condominiumId } = useAuth();
  const { error: toastError } = useToast();
  const { t } = useTranslation();
  const [residents, setResidents] = useState<ResidentDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filterUnitId, setFilterUnitId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    if (!condominiumId) {
      setResidents([]);
      setUnits([]);
      setLoadError(t('residents.error.noCondominium'));
      setLoading(false);
      return;
    }

    Promise.all([
      residentsApi.getAll().then((r) => setResidents(r.data)),
      unitsApi.getAll(condominiumId).then((r) => setUnits(r.data)),
    ])
      .catch(() => setLoadError(t('residents.error.load')))
      .finally(() => setLoading(false));
  }, [condominiumId, t]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      load();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [load]);

  const handleDelete = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await residentsApi.delete(deleteId);
      load();
    } catch {
      toastError(t('residents.error.delete'));
    } finally {
      setDeleteId(null);
    }
  };

  const unitLabel = (unitId: string) => {
    const u = units.find((u) => u.id === unitId);
    return u
      ? t('residents.unitLabel', { number: u.number ?? '', floor: u.floor ?? '' })
      : `${unitId.slice(0, 8)}…`;
  };

  const filtered = residents.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase());
    const matchesUnit = filterUnitId ? r.unitId === filterUnitId : true;
    return matchesSearch && matchesUnit;
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-20 text-ink-subtle">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>{t('residents.accessDenied')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteId !== null}
        title={t('residents.delete.title')}
        message={t('residents.delete.message')}
        confirmLabel={t('residents.delete.confirm')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <PageHeader
        title={t('residents.title')}
        subtitle={t('residents.subtitle', { count: residents.length })}
        search={
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('residents.searchPlaceholder')}
            className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        }
        actions={
          <select
            value={filterUnitId}
            onChange={(e) => setFilterUnitId(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface"
          >
            <option value="">{t('residents.filter.allUnits')}</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {t('residents.unitLabel', { number: u.number ?? '', floor: u.floor ?? '' })}
              </option>
            ))}
          </select>
        }
      />

      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={load}
        isEmpty={filtered.length === 0}
        skeleton="card"
        empty={<EmptyState icon={Users} title={t('residents.empty')} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm shrink-0">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-ink">{r.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[r.role] ?? 'bg-control text-ink-muted'}`}>
                      {roleLabels(t)[r.role] ?? r.role}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleDelete(r.id)} className="text-ink-subtle hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-ink-subtle">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{r.email}</span>
                </div>
                {r.phone && (
                  <div className="flex items-center gap-2 text-sm text-ink-subtle">
                    <Phone className="w-3.5 h-3.5" />
                    {r.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-ink-subtle">
                  <Home className="w-3.5 h-3.5" />
                  {unitLabel(r.unitId)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}

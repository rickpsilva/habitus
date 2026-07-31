import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Trash2, Edit2, MapPin, CheckCircle, XCircle, UserPlus, Copy, Mail, X } from 'lucide-react';
import { condominiumsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import AssociateExistingAdminForm from '../components/AssociateExistingAdminForm';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import { PageHeader, Button, AsyncState, EmptyState, Card } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';
import type { CondominiumDto, CreateCondominiumRequest, UpdateCondominiumRequest, PaginatedResponse } from '../types';

export default function CondominiumsPage() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const { t } = useTranslation();
  
  // Guard: Only Manager can access
  useEffect(() => {
    if (!isManager) {
      navigate('/dashboard');
    }
  }, [isManager, navigate]);
  
  const [condominiums, setCondominiums] = useState<CondominiumDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<CondominiumDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [associateAdminCondo, setAssociateAdminCondo] = useState<CondominiumDto | null>(null);
  const [copiedLinkCondoId, setCopiedLinkCondoId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [formData, setFormData] = useState<CreateCondominiumRequest>({
    name: '',
    address: '',
    taxId: '',
    email: '',
    postalCode: '',
    locality: '',
    contactPhone: '',
  });
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async (page: number = 1) => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await condominiumsApi.getPaged(page, pageSize, debouncedSearch);
      setPagination(response.data);
      setCondominiums(response.data.items);
      setCurrentPage(page);
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error);
      setLoadError(t('condominiums.error.load'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, t]);

  useEffect(() => {
    load(1);
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        const updateRequest: UpdateCondominiumRequest = {
          id: editingId,
          name: formData.name,
          address: formData.address,
          taxId: formData.taxId,
          postalCode: formData.postalCode,
          locality: formData.locality,
          isActive: isActive,
        };
        await condominiumsApi.update(editingId, updateRequest);
      } else {
        await condominiumsApi.create(formData);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', address: '', taxId: '', email: '', postalCode: '', locality: '', contactPhone: '' });
      setIsActive(true);
      load();
    } catch (error) {
      console.error('Erro ao guardar condomínio:', error);
      toastError(t('condominiums.error.save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (condo: CondominiumDto) => {
    setEditingId(condo.id);
    setFormData({
      name: condo.name,
      address: condo.address,
      taxId: condo.taxId,
      email: condo.email || '',
      postalCode: condo.postalCode || '',
      locality: condo.locality || '',
      contactPhone: condo.contactPhone || '',
    });
    setIsActive(condo.isActive);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await condominiumsApi.delete(deleteId);
      load();
    } catch (error) {
      console.error('Erro ao remover condomínio:', error);
      toastError(t('condominiums.error.delete'));
    } finally {
      setDeleteId(null);
    }
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({ name: '', address: '', taxId: '', email: '', postalCode: '', locality: '', contactPhone: '' });
    setIsActive(true);
    setShowModal(true);
  };

  const getAdminRegisterPath = (condominiumId: string) => `/user/register/${condominiumId}/admin`;

  const getAdminRegisterUrl = (condominiumId: string) => `${window.location.origin}${getAdminRegisterPath(condominiumId)}`;

  const handleCopyAdminRegisterUrl = async (condominiumId: string) => {
    try {
      await navigator.clipboard.writeText(getAdminRegisterUrl(condominiumId));
      setCopiedLinkCondoId(condominiumId);
      setTimeout(() => setCopiedLinkCondoId((current) => (current === condominiumId ? null : current)), 2000);
    } catch (error) {
      console.error('Erro ao copiar link de registo de administrador:', error);
      toastError(t('condominiums.error.copyLink'));
    }
  };

  const closeAssociateAdminModal = () => {
    setAssociateAdminCondo(null);
    setCopiedLinkCondoId(null);
  };

  if (!isManager) {
    return (
      <div className="text-center py-20 text-ink-subtle">
        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>{t('condominiums.accessRestricted')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteId !== null}
        title={t('condominiums.delete.title')}
        message={t('condominiums.delete.message')}
        confirmLabel={t('condominiums.delete.confirm')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      {associateAdminCondo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="associate-admin-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) closeAssociateAdminModal(); }}
        >
          <div className="bg-surface rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h3 id="associate-admin-title" className="font-semibold text-ink text-lg">
                {t('associateAdmin.modalTitle', { condominiumName: associateAdminCondo.name })}
              </h3>
              <button
                type="button"
                onClick={closeAssociateAdminModal}
                aria-label={t('common.close')}
                className="text-ink-subtle hover:text-ink-muted transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <section>
              <h4 className="text-sm font-semibold text-ink mb-2">{t('associateAdmin.existingUserHeading')}</h4>
              <AssociateExistingAdminForm
                condominiumId={associateAdminCondo.id}
                condominiumName={associateAdminCondo.name}
              />
            </section>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-line" />
              <span className="text-xs font-medium uppercase text-ink-subtle">{t('associateAdmin.divider')}</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            <section>
              <h4 className="text-sm font-semibold text-ink mb-2">{t('associateAdmin.newUserHeading')}</h4>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                <p className="text-xs font-medium text-emerald-800 mb-1">{t('condominiums.card.adminLinkTitle')}</p>
                <p className="text-xs text-emerald-700 mb-2">{t('condominiums.card.adminLinkDescription')}</p>
                <a
                  href={getAdminRegisterPath(associateAdminCondo.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-emerald-700 underline break-all"
                >
                  {getAdminRegisterUrl(associateAdminCondo.id)}
                </a>
                <button
                  onClick={() => handleCopyAdminRegisterUrl(associateAdminCondo.id)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedLinkCondoId === associateAdminCondo.id ? t('condominiums.card.copied') : t('condominiums.card.copyLink')}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      <PageHeader
        title={t('condominiums.title')}
        subtitle={t('condominiums.subtitle', { count: condominiums.length })}
        search={
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('condominiums.searchPlaceholder')}
          />
        }
        actions={
          <Button icon={Plus} onClick={handleNew} fullWidth className="sm:w-auto">
            {t('condominiums.new')}
          </Button>
        }
      />

      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={() => load(currentPage)}
        isEmpty={condominiums.length === 0}
        skeleton="card"
        empty={<EmptyState icon={Building2} title={t('condominiums.empty')} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {condominiums.map((condo) => (
            <Card key={condo.id} interactive className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-ink mb-1">{condo.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs">
                    {condo.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3 h-3" />
                        {t('common.active')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-control text-ink-muted">
                        <XCircle className="w-3 h-3" />
                        {t('common.inactive')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setAssociateAdminCondo(condo)}
                    className="p-1.5 text-ink-subtle hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                    title={t('condominiums.card.generateAdminLink')}
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(condo)}
                    className="p-1.5 text-ink-subtle hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(condo.id)}
                    className="p-1.5 text-ink-subtle hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-ink-muted">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div>{condo.address}</div>
                    <div className="text-sm text-ink-muted">{condo.postalCode} {condo.locality}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-ink-muted">
                  <span className="font-mono text-xs bg-control px-2 py-1 rounded">NIPC: {condo.taxId}</span>
                </div>
                <div className="flex items-center gap-2 text-ink-muted">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{condo.email || t('condominiums.card.noEmail')}</span>
                </div>
                {condo.contactPhone && (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <span className="text-sm">{t('condominiums.card.phone', { phone: condo.contactPhone })}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </AsyncState>
      
      {pagination && !loading && condominiums.length > 0 && (
        <Pagination
          pagination={pagination}
          currentPage={currentPage}
          onPageChange={(page) => load(page)}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-ink mb-4">
              {editingId ? t('condominiums.form.editTitle') : t('condominiums.form.newTitle')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condominiums.form.name')}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condominiums.form.address')}</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
               <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condominiums.form.postalCode')}</label>
                <input
                  type="text"
                  required
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condominiums.form.locality')}</label>
                <input
                  type="text"
                  required
                  value={formData.locality}
                  onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">NIPC *</label>
                <input
                  type="text"
                  required
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('condominiums.form.email')} {editingId ? '' : <span className="text-ink-subtle">{t('condominiums.form.optional')}</span>}
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="geral@condominio.pt"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${editingId ? 'border-line bg-surface-muted text-ink-subtle' : 'border-line bg-surface text-ink'}`}
                />
                <p className="text-xs text-ink-subtle mt-1">
                  {editingId
                    ? t('condominiums.form.emailHelpEdit')
                    : t('condominiums.form.emailHelpCreate')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condominiums.form.contactPhone')}</label>
                <input
                  type="tel"
                  value={formData.contactPhone || ''}
                  placeholder="+351 220 000 000"
                  disabled
                  className="w-full px-3 py-2 border border-line bg-surface-muted text-ink-subtle rounded-lg"
                />
              </div>
              {editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-line rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-ink-muted">
                    {t('common.active')}
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  fullWidth
                  className="flex-1 border border-line"
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={submitting} fullWidth className="flex-1">
                  {editingId ? t('condominiums.form.save') : t('condominiums.form.create')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Warehouse, Truck, Home, FileText, CreditCard, Mail, Save, KeyRound, Server, Languages
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { marked } from 'marked';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import ModalPopup from '../components/ModalPopup';
import { PageHeader, Spinner, ErrorState, Button, Card } from '../components/ui';
import RichTextEditor, { type RichTextTokenDefinition } from '../components/RichTextEditor';
import { paymentSettingsApi, communicationSettingsApi, platformBillingSettingsApi, condominiumsApi, systemEmailSettingsApi, receiptTemplateSettingsApi, uploadSettingsApi, platformLocalizationApi } from '../api/services';
import type {
  CommunicationSettingsDto,
  UpdateCommunicationSettingsRequest,
  PlatformBillingSettingsDto,
  UpdatePlatformBillingSettingsRequest,
  PlatformUploadSettingsDto,
  UpdatePlatformUploadSettingsRequest,
  SystemEmailSettingsDto,
  UpdateSystemEmailSettingsRequest,
  PlatformLocalizationSettingsDto,
} from '../types';
import { formatUploadSizeLabel, invalidatePlatformUploadSizeCache } from '../utils/uploadLimits';
import SharedSpacesPage from './SharedSpacesPage';
import SuppliersPage from './SuppliersPage';
import UnitsPage from './UnitsPage';

const isHtmlTemplate = (value: string) => /<\/?[a-zA-Z][^>]*>/.test(value);

const templateToEditorHtml = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return isHtmlTemplate(trimmed) ? trimmed : (marked.parse(trimmed) as string);
};

type TabKey = 'general' | 'spaces' | 'suppliers' | 'units' | 'receipts' | 'payments' | 'communication' | 'platform-billing' | 'platform-upload' | 'system-email' | 'localization';

interface Tab {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

const getAdminTabs = (t: TranslateFn): Tab[] => [
  { key: 'general', label: t('condoSettings.tab.general'), icon: Home },
  { key: 'spaces', label: t('condoSettings.tab.spaces'), icon: Warehouse },
  { key: 'suppliers', label: t('condoSettings.tab.suppliers'), icon: Truck },
  { key: 'units', label: t('condoSettings.tab.units'), icon: Home },
  { key: 'receipts', label: t('condoSettings.tab.receipts'), icon: FileText },
  { key: 'payments', label: t('condoSettings.tab.payments'), icon: CreditCard },
  { key: 'communication', label: t('condoSettings.tab.communication'), icon: Mail },
];

const getManagerTabs = (t: TranslateFn): Tab[] => [
  { key: 'platform-billing', label: t('condoSettings.tab.platformBilling'), icon: KeyRound },
  { key: 'platform-upload', label: t('condoSettings.tab.platformUpload'), icon: FileText },
  { key: 'system-email', label: t('condoSettings.tab.systemEmail'), icon: Server },
  { key: 'localization', label: t('localization.tab'), icon: Languages },
];

export default function CondominiumSettingsPage() {
  const { isAdmin, isManager } = useAuth();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleTabs = isManager ? getManagerTabs(t) : getAdminTabs(t);

  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab = tabParam && visibleTabs.some((tab) => tab.key === tabParam)
    ? tabParam
    : (visibleTabs[0]?.key ?? 'spaces');

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  if (!isAdmin && !isManager) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-subtle">{t('condoSettings.accessManagementOnly')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isManager ? t('condoSettings.platformTitle') : t('condoSettings.condoTitle')}
        subtitle={isManager ? t('condoSettings.platformSubtitle') : t('condoSettings.condoSubtitle')}
      />

      {/* Tabs */}
      <Card className="overflow-hidden">
        <div className="flex overflow-x-auto border-b border-line">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-ink-subtle hover:text-ink-muted hover:bg-surface-hover'
              }`}
            >
              <Icon className="w-4 h-4" />
              {key === 'localization' ? t('localization.tab') : label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Content for each tab */}
          {activeTab === 'spaces' && <SharedSpacesContent />}
          {activeTab === 'suppliers' && <SuppliersContent />}
          {activeTab === 'units' && <UnitsContent />}
          {activeTab === 'general' && <GeneralCondominiumContent />}
          {activeTab === 'receipts' && <ReceiptTemplateContent />}
          {activeTab === 'payments' && <PaymentMethodsContent />}
          {activeTab === 'communication' && <CommunicationChannelsContent />}
          {activeTab === 'platform-billing' && <PlatformBillingContent />}
          {activeTab === 'platform-upload' && <PlatformUploadContent />}
          {activeTab === 'system-email' && <SystemEmailContent />}
          {activeTab === 'localization' && <LocalizationContent />}
        </div>
      </Card>
    </div>
  );
}

function GeneralCondominiumContent() {
  const { condominiumId, isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();
  const [condominiumData, setCondominiumData] = useState<{ name: string; address: string; taxId: string; isActive: boolean } | null>(null);
  const [email, setEmail] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [locality, setLocality] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [condominiumName, setCondominiumName] = useState('');

  useEffect(() => {
    const loadCondominium = async () => {
      if (!condominiumId) return;
      setLoading(true);
      setLoadError('');
      try {
        const response = await condominiumsApi.getById(condominiumId);
        setCondominiumName(response.data.name);
        setEmail(response.data.email || '');
        setPostalCode(response.data.postalCode || '');
        setLocality(response.data.locality || '');
        setContactPhone(response.data.contactPhone || '');
        setCondominiumData({
          name: response.data.name,
          address: response.data.address,
          taxId: response.data.taxId,
          isActive: response.data.isActive,
        });
      } catch (error) {
        console.error('Error loading condominium data:', error);
        setLoadError(t('condoSettings.general.errorLoad'));
        toastError(t('condoSettings.general.errorLoadToast'));
      } finally {
        setLoading(false);
      }
    };

    loadCondominium();
  }, [condominiumId, toastError, t]);

  const handleSave = async () => {
    if (!condominiumId || !condominiumData) return;
    setSaving(true);
    try {
      if (isAdmin) {
        // Admins may only update email and contact phone from this page
        await condominiumsApi.updateEmail(condominiumId, email.trim() || '');
        await condominiumsApi.updateContactPhone(condominiumId, contactPhone.trim() || '');
      } else {
        await condominiumsApi.update(condominiumId, {
          id: condominiumId,
          name: condominiumData.name,
          address: condominiumData.address,
          taxId: condominiumData.taxId,
          email: email.trim() || '',
          postalCode: postalCode.trim() || '',
          locality: locality.trim() || '',
          contactPhone: contactPhone.trim() || '',
          isActive: condominiumData.isActive,
        });
      }
      toastSuccess(t('condoSettings.general.saveSuccess'));
    } catch (error) {
      console.error('Error saving condominium data:', error);
      toastError(t('condoSettings.general.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8 text-ink-subtle"><Spinner label={t('condoSettings.loading')} /></div>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      )}

      <div>
        <h3 className="text-lg font-semibold text-ink mb-1">{t('condoSettings.general.title')}</h3>
        <p className="text-sm text-ink-subtle">{t('condoSettings.general.subtitle')}</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="border border-line rounded-lg p-5 bg-surface space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.general.condominium')}</label>
            <input
              type="text"
              value={condominiumName}
              disabled
              className="w-full px-3 py-2 border border-line bg-surface-muted text-ink-subtle rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.general.address')}</label>
            <textarea
              value={condominiumData?.address || ''}
              disabled
              className="w-full px-3 py-2 border border-line bg-surface-muted text-ink-subtle rounded-lg"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.general.taxId')}</label>
            <input
              type="text"
              value={condominiumData?.taxId || ''}
              disabled
              className="w-full px-3 py-2 border border-line bg-surface-muted text-ink-subtle rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.general.postalCode')}</label>
              <input
                type="text"
                value={postalCode}
                disabled
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="4000-123"
                className="w-full px-3 py-2 border border-line bg-surface-muted text-ink-subtle rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.general.locality')}</label>
              <input
                type="text"
                value={locality}
                disabled
                onChange={(e) => setLocality(e.target.value)}
                placeholder="Porto"
                className="w-full px-3 py-2 border border-line bg-surface-muted text-ink-subtle rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.general.condoEmail')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="geral@condominio.pt"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.general.emailHint')}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.general.contactPhone')}</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+351 220 000 000"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button icon={Save} onClick={handleSave} loading={saving}>
            {t('condoSettings.general.saveButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlatformBillingContent() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PlatformBillingSettingsDto | null>(null);
  const [form, setForm] = useState<UpdatePlatformBillingSettingsRequest>({
    gatewayEnabled: false,
    gatewayProvider: 'stripe',
    publicKey: '',
    secretKey: '',
    webhookSecret: '',
    merchantDisplayName: '',
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await platformBillingSettingsApi.get();
        setSettings(response.data);
        setForm({
          gatewayEnabled: response.data.gatewayEnabled,
          gatewayProvider: response.data.gatewayProvider || 'stripe',
          publicKey: response.data.publicKey || '',
          secretKey: '',
          webhookSecret: '',
          merchantDisplayName: response.data.merchantDisplayName || '',
        });
      } catch (error) {
        console.error('Error loading platform billing settings:', error);
        setLoadError(t('condoSettings.billing.errorLoad'));
        toastError(t('condoSettings.billing.errorLoadToast'));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [toastError, t]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await platformBillingSettingsApi.update(form);
      setSettings(response.data);
      setForm((prev) => ({ ...prev, secretKey: '', webhookSecret: '' }));
      toastSuccess(t('condoSettings.billing.saveSuccess'));
    } catch (error) {
      console.error('Error saving platform billing settings:', error);
      toastError(t('condoSettings.billing.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8 text-ink-subtle"><Spinner label={t('condoSettings.loading')} /></div>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      )}

      <div>
        <h3 className="text-lg font-semibold text-ink mb-1">{t('condoSettings.billing.title')}</h3>
        <p className="text-sm text-ink-subtle">{t('condoSettings.billing.subtitle')}</p>
      </div>

      <div className="space-y-4 max-w-3xl">
        <div className="border border-line rounded-lg overflow-hidden">
          <div className="p-4 bg-surface">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-ink">{t('condoSettings.billing.checkoutName')}</p>
                  {form.gatewayEnabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">{t('common.active')}</span>
                  )}
                </div>
                <p className="text-sm text-ink-subtle">{t('condoSettings.billing.checkoutDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={form.gatewayEnabled}
                  onChange={(e) => setForm({ ...form, gatewayEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="px-4 pb-4 bg-surface-muted border-t border-line space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-blue-900 font-medium mb-1">{t('condoSettings.billing.globalConfigTitle')}</p>
              <p className="text-xs text-blue-700">
                {t('condoSettings.billing.globalConfigDesc')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Provider</label>
              <select
                value={form.gatewayProvider}
                onChange={(e) => setForm({ ...form, gatewayProvider: e.target.value })}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="stripe">Stripe</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Public Key</label>
              <input
                type="text"
                value={form.publicKey || ''}
                onChange={(e) => setForm({ ...form, publicKey: e.target.value })}
                placeholder="pk_live_..."
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Merchant Display Name</label>
              <input
                type="text"
                value={form.merchantDisplayName || ''}
                onChange={(e) => setForm({ ...form, merchantDisplayName: e.target.value })}
                placeholder="Habitus Billing"
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Secret Key</label>
              <input
                type="password"
                value={form.secretKey || ''}
                onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                placeholder={settings?.hasSecretKey ? t('condoSettings.billing.secretConfiguredPlaceholder') : 'sk_live_...'}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Webhook Secret</label>
              <input
                type="password"
                value={form.webhookSecret || ''}
                onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                placeholder={settings?.hasWebhookSecret ? t('condoSettings.billing.webhookConfiguredPlaceholder') : 'whsec_...'}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <p className="text-ink-subtle">Secret Key</p>
                <p className="font-medium text-ink">{settings?.hasSecretKey ? t('condoSettings.billing.configuredF') : t('condoSettings.billing.missing')}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <p className="text-ink-subtle">Webhook Secret</p>
                <p className="font-medium text-ink">{settings?.hasWebhookSecret ? t('condoSettings.billing.configuredM') : t('condoSettings.billing.missing')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button icon={Save} onClick={handleSave} loading={saving}>
            {t('condoSettings.saveSettings')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlatformUploadContent() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();
  const minSizeKb = 50;
  const maxSizeKb = 512000;
  const [settings, setSettings] = useState<PlatformUploadSettingsDto | null>(null);
  const [form, setForm] = useState<UpdatePlatformUploadSettingsRequest>({
    maxUploadSizeBytes: 600 * 1024,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await uploadSettingsApi.get();
        setSettings(response.data);
        setForm({ maxUploadSizeBytes: response.data.maxUploadSizeBytes });
      } catch (error) {
        console.error('Error loading upload settings:', error);
        setLoadError(t('condoSettings.upload.errorLoad'));
        toastError(t('condoSettings.upload.errorLoadToast'));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [toastError, t]);

  const handleSave = async () => {
    const normalizedBytes = Math.round(form.maxUploadSizeBytes);
    const minBytes = minSizeKb * 1024;
    const maxBytes = maxSizeKb * 1024;

    if (!Number.isFinite(normalizedBytes) || normalizedBytes < minBytes || normalizedBytes > maxBytes) {
      toastError(t('condoSettings.upload.rangeError', { min: formatUploadSizeLabel(minBytes), max: formatUploadSizeLabel(maxBytes) }));
      return;
    }

    setSaving(true);
    try {
      const response = await uploadSettingsApi.update({ maxUploadSizeBytes: normalizedBytes });
      setSettings(response.data);
      setForm({ maxUploadSizeBytes: response.data.maxUploadSizeBytes });
      invalidatePlatformUploadSizeCache();
      toastSuccess(t('condoSettings.upload.saveSuccess'));
    } catch (error: unknown) {
      console.error('Error saving upload settings:', error);
      const apiMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        (error as { response?: { data?: { message?: string } } }).response?.data?.message;

      toastError(apiMessage || t('condoSettings.upload.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8 text-ink-subtle"><Spinner label={t('condoSettings.loading')} /></div>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      )}

      <div>
        <h3 className="text-lg font-semibold text-ink mb-1">{t('condoSettings.upload.title')}</h3>
        <p className="text-sm text-ink-subtle">{t('condoSettings.upload.subtitle')}</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="border border-line rounded-lg p-4 bg-surface space-y-3">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.upload.maxSizeLabel')}</label>
            <input
              type="number"
              min={minSizeKb}
              max={maxSizeKb}
              step={1}
              value={Math.round(form.maxUploadSizeBytes / 1024)}
              onChange={(e) => {
                const valueInKb = Number(e.target.value);
                const normalizedKb = Number.isNaN(valueInKb)
                  ? 0
                  : Math.min(maxSizeKb, Math.max(minSizeKb, Math.round(valueInKb)));
                const nextBytes = normalizedKb * 1024;
                setForm({ maxUploadSizeBytes: nextBytes });
              }}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-ink-subtle mt-1">
              {t('condoSettings.upload.rangeHint', { min: formatUploadSizeLabel(minSizeKb * 1024), max: formatUploadSizeLabel(maxSizeKb * 1024) })}
            </p>
            <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.upload.currentValue', { value: formatUploadSizeLabel(form.maxUploadSizeBytes) })}</p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            {t('condoSettings.upload.appliedInfo')}
          </div>

          {settings && (
            <div className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-ink-muted">
              {t('condoSettings.upload.lastUpdate', { date: new Date(settings.updatedAt).toLocaleString('pt-PT') })}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button icon={Save} onClick={handleSave} loading={saving}>
            {t('condoSettings.upload.saveButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Platform-wide default language (REQ-I18N-001): pick the default language
// applied to all users. Multilanguage support is a subscription-plan feature,
// managed in the Billing/Plan editor. The PUT is Manager-only server-side; the
// UI is guarded to match.
function LocalizationContent() {
  const { isManager } = useAuth();
  const { t } = useTranslation();
  const { success: toastSuccess, error: toastError } = useToast();
  const languageOptions: ('pt' | 'en')[] = ['pt', 'en'];
  const [settings, setSettings] = useState<PlatformLocalizationSettingsDto | null>(null);
  const [defaultLanguage, setDefaultLanguage] = useState<'pt' | 'en'>('pt');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await platformLocalizationApi.get();
        setSettings(response.data);
        setDefaultLanguage(response.data.defaultLanguage === 'en' ? 'en' : 'pt');
      } catch {
        setLoadError(t('localization.errorLoad'));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [t]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await platformLocalizationApi.update({
        defaultLanguage,
      });
      setSettings(response.data);
      setDefaultLanguage(response.data.defaultLanguage === 'en' ? 'en' : 'pt');
      toastSuccess(t('localization.saved'));
    } catch {
      toastError(t('localization.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8 text-ink-subtle"><Spinner label="..." /></div>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      )}

      <div>
        <h3 className="text-lg font-semibold text-ink mb-1">{t('localization.title')}</h3>
        <p className="text-sm text-ink-subtle">{t('localization.subtitle')}</p>
        <p className="mt-1 text-xs text-ink-subtle">{t('localization.scopeHint')}</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="border border-line rounded-lg p-4 bg-surface space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('localization.defaultLanguage')}</label>
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value === 'en' ? 'en' : 'pt')}
              disabled={!isManager}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {languageOptions.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'pt' ? t('localization.pt') : t('localization.en')}
                </option>
              ))}
            </select>
          </div>

          {settings && settings.id && (
            <div className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-ink-muted">
              {new Date(settings.updatedAt).toLocaleString('pt-PT')}
            </div>
          )}
        </div>

        {isManager && (
          <div className="flex gap-3 pt-2">
            <Button icon={Save} onClick={handleSave} loading={saving}>
              {t('localization.save')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper components to render existing pages without layout
function SharedSpacesContent() {
  return <SharedSpacesPage embedded />;
}

function SuppliersContent() {
  return <SuppliersPage embedded />;
}

function UnitsContent() {
  return (
    <UnitsPage embedded />
  );
}

function ReceiptTemplateContent() {
  const { condominiumId } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();
  const [activeTemplateType, setActiveTemplateType] = useState<'monthlyFee' | 'monthlyFeeQuarterly' | 'monthlyFeeAnnual' | 'reservation' | 'other'>('monthlyFee');
  const [template, setTemplate] = useState({
    template: '',
    templateMonthlyFee: '',
    templateMonthlyFeeQuarterly: '',
    templateMonthlyFeeAnnual: '',
    templateExtraordinaryFee: '',
    templateReservation: '',
    templateOther: '',
    includeCondominiumName: true,
    includeTaxId: true,
    includeAddress: true,
    includePostalCode: true,
    includeLocality: true,
    includeEmail: true,
    includeContactPhone: true,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const tagDefinitions: RichTextTokenDefinition[] = useMemo(() => [
    {
      token: '{resident_name}',
      label: t('condoSettings.receipt.tag.residentName.label'),
      description: t('condoSettings.receipt.tag.residentName.desc'),
      example: 'Joana Silva',
      missingBehavior: t('condoSettings.receipt.missing.empty'),
      category: t('condoSettings.receipt.cat.payer'),
    },
    {
      token: '{unit_number}',
      label: t('condoSettings.receipt.tag.unitNumber.label'),
      description: t('condoSettings.receipt.tag.unitNumber.desc'),
      example: 'A-12',
      missingBehavior: t('condoSettings.receipt.missing.empty'),
      category: t('condoSettings.receipt.cat.unit'),
    },
    {
      token: '{unit_port}',
      label: t('condoSettings.receipt.tag.unitPort.label'),
      description: t('condoSettings.receipt.tag.unitPort.desc'),
      example: '3',
      missingBehavior: t('condoSettings.receipt.missing.empty'),
      category: t('condoSettings.receipt.cat.unit'),
    },
    {
      token: '{unit_build}',
      label: t('condoSettings.receipt.tag.unitBuild.label'),
      description: t('condoSettings.receipt.tag.unitBuild.desc'),
      example: t('condoSettings.receipt.example.condoName'),
      missingBehavior: t('condoSettings.receipt.missing.empty'),
      category: t('condoSettings.receipt.cat.condominium'),
    },
    {
      token: '{value_amount}',
      label: t('condoSettings.receipt.tag.valueAmount.label'),
      description: t('condoSettings.receipt.tag.valueAmount.desc'),
      example: '75.00',
      missingBehavior: t('condoSettings.receipt.missing.zeroValue'),
      category: t('condoSettings.receipt.cat.payment'),
    },
    {
      token: '{quote_period_month_start}',
      label: t('condoSettings.receipt.tag.periodMonthStart.label'),
      description: t('condoSettings.receipt.tag.periodMonthStart.desc'),
      example: t('condoSettings.receipt.example.january'),
      missingBehavior: t('condoSettings.receipt.missing.untilPeriod'),
      category: t('condoSettings.receipt.cat.fee'),
    },
    {
      token: '{quote_period_month_end}',
      label: t('condoSettings.receipt.tag.periodMonthEnd.label'),
      description: t('condoSettings.receipt.tag.periodMonthEnd.desc'),
      example: t('condoSettings.receipt.example.march'),
      missingBehavior: t('condoSettings.receipt.missing.untilPeriod'),
      category: t('condoSettings.receipt.cat.fee'),
    },
    {
      token: '{quote_period_month}',
      label: t('condoSettings.receipt.tag.periodMonth.label'),
      description: t('condoSettings.receipt.tag.periodMonth.desc'),
      example: t('condoSettings.receipt.example.january'),
      missingBehavior: t('condoSettings.receipt.missing.notMonthly'),
      category: t('condoSettings.receipt.cat.fee'),
    },
    {
      token: '{current_day}',
      label: t('condoSettings.receipt.tag.currentDay.label'),
      description: t('condoSettings.receipt.tag.currentDay.desc'),
      example: '13',
      missingBehavior: t('condoSettings.receipt.missing.usesCurrentDate'),
      category: t('common.date'),
    },
    {
      token: '{current_month}',
      label: t('condoSettings.receipt.tag.currentMonth.label'),
      description: t('condoSettings.receipt.tag.currentMonth.desc'),
      example: t('condoSettings.receipt.example.may'),
      missingBehavior: t('condoSettings.receipt.missing.usesCurrentDate'),
      category: t('common.date'),
    },
    {
      token: '{current_year}',
      label: t('condoSettings.receipt.tag.currentYear.label'),
      description: t('condoSettings.receipt.tag.currentYear.desc'),
      example: '2026',
      missingBehavior: t('condoSettings.receipt.missing.usesCurrentDate'),
      category: t('common.date'),
    },
  ], [t]);

  const templateTypeOptions = [
    { key: 'monthlyFee', label: t('condoSettings.receipt.type.monthly') },
    { key: 'monthlyFeeQuarterly', label: t('condoSettings.receipt.type.quarterly') },
    { key: 'monthlyFeeAnnual', label: t('condoSettings.receipt.type.annual') },
    { key: 'reservation', label: t('condoSettings.receipt.type.reservation') },
    { key: 'other', label: t('condoSettings.receipt.type.other') },
  ] as const;

  const templateFieldByType = {
    monthlyFee: 'templateMonthlyFee',
    monthlyFeeQuarterly: 'templateMonthlyFeeQuarterly',
    monthlyFeeAnnual: 'templateMonthlyFeeAnnual',
    reservation: 'templateReservation',
    other: 'templateOther',
  } as const;

  const receiptInfoToggleOptions: Array<{
    key:
      | 'includeCondominiumName'
      | 'includeTaxId'
      | 'includeAddress'
      | 'includePostalCode'
      | 'includeLocality'
      | 'includeEmail'
      | 'includeContactPhone';
    label: string;
  }> = [
    { key: 'includeCondominiumName', label: t('condoSettings.receipt.info.condoName') },
    { key: 'includeTaxId', label: t('condoSettings.general.taxId') },
    { key: 'includeAddress', label: t('condoSettings.general.address') },
    { key: 'includePostalCode', label: t('condoSettings.general.postalCode') },
    { key: 'includeLocality', label: t('condoSettings.general.locality') },
    { key: 'includeEmail', label: 'Email' },
    { key: 'includeContactPhone', label: t('condoSettings.general.contactPhone') },
  ];

  const activeTemplateField = templateFieldByType[activeTemplateType];
  const knownTagTokens = useMemo(
    () => new Set(tagDefinitions.map((definition) => definition.token.toLowerCase())),
    [tagDefinitions],
  );
  const unknownTags = useMemo(() => {
    const values = [
      template.templateMonthlyFee,
      template.templateMonthlyFeeQuarterly,
      template.templateMonthlyFeeAnnual,
      template.templateReservation,
      template.templateOther,
      template.templateExtraordinaryFee,
    ];

    return Array.from(new Set(values.flatMap((value) => {
      const matches = value.match(/\{[^}]+\}/g) || [];
      return matches.filter((token) => !knownTagTokens.has(token.toLowerCase()));
    })));
  }, [
    knownTagTokens,
    template.templateExtraordinaryFee,
    template.templateMonthlyFee,
    template.templateMonthlyFeeAnnual,
    template.templateMonthlyFeeQuarterly,
    template.templateOther,
    template.templateReservation,
  ]);

  useEffect(() => {
    const loadTemplate = async () => {
      if (!condominiumId) return;
      setLoading(true);
      setLoadError('');
      try {
        const response = await receiptTemplateSettingsApi.get(condominiumId);
        setTemplate({
          template: response.data.template || '',
          templateMonthlyFee: templateToEditorHtml(response.data.templateMonthlyFee || response.data.template || ''),
          templateMonthlyFeeQuarterly: templateToEditorHtml(response.data.templateMonthlyFeeQuarterly || response.data.templateMonthlyFee || response.data.template || ''),
          templateMonthlyFeeAnnual: templateToEditorHtml(response.data.templateMonthlyFeeAnnual || response.data.templateMonthlyFeeQuarterly || response.data.templateMonthlyFee || response.data.template || ''),
          templateExtraordinaryFee: templateToEditorHtml(response.data.templateExtraordinaryFee || response.data.template || ''),
          templateReservation: templateToEditorHtml(response.data.templateReservation || response.data.template || ''),
          templateOther: templateToEditorHtml(response.data.templateOther || response.data.template || ''),
          includeCondominiumName: response.data.includeCondominiumName ?? true,
          includeTaxId: response.data.includeTaxId ?? true,
          includeAddress: response.data.includeAddress ?? true,
          includePostalCode: response.data.includePostalCode ?? true,
          includeLocality: response.data.includeLocality ?? true,
          includeEmail: response.data.includeEmail ?? true,
          includeContactPhone: response.data.includeContactPhone ?? true,
        });
      } catch (error) {
        console.error('Error loading receipt template settings:', error);
        const isNotFound =
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof (error as { response?: { status?: number } }).response?.status === 'number' &&
          (error as { response?: { status?: number } }).response?.status === 404;

        // When no template exists yet (or backend route is not available), keep defaults without showing an error toast.
        if (isNotFound) {
          return;
        }

        setLoadError(t('condoSettings.receipt.errorLoad'));

        const errorMessage =
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? t('condoSettings.receipt.errorLoadToast')
            : t('condoSettings.receipt.errorLoadToast');
        toastError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [condominiumId, toastError, t]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!condominiumId) return;

    setSaving(true);
    try {
      await receiptTemplateSettingsApi.update(condominiumId, {
        template: template.templateMonthlyFee || template.template || undefined,
        templateMonthlyFee: template.templateMonthlyFee || undefined,
        templateMonthlyFeeQuarterly: template.templateMonthlyFeeQuarterly || undefined,
        templateMonthlyFeeAnnual: template.templateMonthlyFeeAnnual || undefined,
        templateExtraordinaryFee: template.templateExtraordinaryFee || undefined,
        templateReservation: template.templateReservation || undefined,
        templateOther: template.templateOther || undefined,
        includeCondominiumName: template.includeCondominiumName,
        includeTaxId: template.includeTaxId,
        includeAddress: template.includeAddress,
        includePostalCode: template.includePostalCode,
        includeLocality: template.includeLocality,
        includeEmail: template.includeEmail,
        includeContactPhone: template.includeContactPhone,
      });
      toastSuccess(t('condoSettings.receipt.saveSuccess'));
    } catch (error) {
      console.error('Error saving receipt template settings:', error);
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number; data?: { message?: string } } }).response?.status === 'number' &&
        (error as { response?: { status?: number; data?: { message?: string } } }).response?.status === 404
          ? t('condoSettings.receipt.errorNotFound')
          : typeof error === 'object' &&
              error !== null &&
              'response' in error &&
              typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? t('condoSettings.receipt.saveError')
            : t('condoSettings.receipt.saveError');
      toastError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8 text-ink-subtle"><Spinner label={t('condoSettings.loading')} /></div>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      )}

      <div>
        <h3 className="text-lg font-semibold text-ink mb-1">{t('condoSettings.receipt.title')}</h3>
        <p className="text-sm text-ink-subtle">{t('condoSettings.receipt.subtitle')}</p>
      </div>

      <form className="space-y-4 max-w-2xl" onSubmit={handleSubmit}>
        <div className="rounded-lg border border-line bg-surface-muted p-4 space-y-3">
          <p className="text-sm font-medium text-ink">{t('condoSettings.receipt.headerInfoTitle')}</p>
          <p className="text-xs text-ink-muted">{t('condoSettings.receipt.headerInfoDesc')}</p>

          <div className="space-y-2">
            {receiptInfoToggleOptions.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2">
                <span className="text-sm text-ink">{item.label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={template[item.key]}
                    onChange={(e) => setTemplate({
                      ...template,
                      [item.key]: e.target.checked,
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {templateTypeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveTemplateType(option.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTemplateType === option.key ? 'bg-indigo-600 text-white' : 'bg-control text-ink hover:bg-control-hover'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium text-ink-muted mb-1">Template</label>
          <RichTextEditor 
            value={template[activeTemplateField]}
            onChange={(v) => setTemplate({ ...template, [activeTemplateField]: v })}
            placeholder={t('condoSettings.receipt.editorPlaceholder')}
            height="240px"
            tokenDefinitions={tagDefinitions}
          />
          {unknownTags.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="font-medium">{t('condoSettings.receipt.unknownTagsTitle')}</p>
              <p className="mt-1 text-xs">{t('condoSettings.receipt.unknownTagsDesc', { tags: unknownTags.join(', ') })}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" icon={Save} loading={saving}>
            {t('condoSettings.receipt.saveButton')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PaymentMethodsContent() {
  const { condominiumId, isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();
  
  const [activeMethodModal, setActiveMethodModal] = useState<'bankTransfer' | 'mbReference' | 'mbWay' | 'card' | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [methods, setMethods] = useState({
    bankTransfer: {
      enabled: true,
      iban: '',
      accountHolder: '',
    },
    mbReference: {
      enabled: false,
      entity: '',
      reference: '',
    },
    mbWay: {
      enabled: false,
      phoneNumber: '',
      merchantId: '',
    },
    card: {
      enabled: false,
      provider: 'stripe',
      publicKey: '',
      secretKey: '',
      merchantId: '',
    },
  });

  const loadPaymentSettings = useCallback(async () => {
    if (!condominiumId) return;
    setLoading(true);
    setLoadError('');
    try {
      const response = await paymentSettingsApi.get(condominiumId);
      const data = response.data;
      
      setMethods({
        bankTransfer: {
          enabled: data.bankTransferEnabled,
          iban: data.bankTransferIban || '',
          accountHolder: data.bankTransferAccountHolder || '',
        },
        mbReference: {
          enabled: data.mbReferenceEnabled,
          entity: data.mbReferenceEntity || '',
          reference: data.mbReferenceReference || '',
        },
        mbWay: {
          enabled: data.mbWayEnabled,
          phoneNumber: data.mbWayPhoneNumber || '',
          merchantId: data.mbWayMerchantId || '',
        },
        card: {
          enabled: data.cardEnabled,
          provider: data.cardProvider || 'stripe',
          publicKey: data.cardPublicKey || '',
          secretKey: '', // Never loaded from server for security
          merchantId: data.cardMerchantId || '',
        },
      });
    } catch (error: unknown) {
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? t('condoSettings.payments.errorLoadToast')
          : t('condoSettings.payments.errorLoadToast');
      console.error('Error loading payment settings:', error);
      setLoadError(t('condoSettings.payments.errorLoad'));
      toastError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [condominiumId, toastError, t]);

  useEffect(() => {
    if (condominiumId) {
      loadPaymentSettings();
    }
  }, [condominiumId, loadPaymentSettings]);

  const handleSave = async (): Promise<boolean> => {
    if (!condominiumId) return false;
    
    setSaving(true);
    try {
      const requestData = {
        bankTransferEnabled: methods.bankTransfer.enabled,
        bankTransferIban: methods.bankTransfer.iban,
        bankTransferAccountHolder: methods.bankTransfer.accountHolder,
        mbReferenceEnabled: methods.mbReference.enabled,
        mbReferenceEntity: methods.mbReference.entity,
        mbReferenceReference: methods.mbReference.reference,
        mbWayEnabled: methods.mbWay.enabled,
        mbWayPhoneNumber: methods.mbWay.phoneNumber,
        mbWayMerchantId: methods.mbWay.merchantId,
        cardEnabled: methods.card.enabled,
        cardProvider: methods.card.provider,
        cardPublicKey: methods.card.publicKey,
        cardSecretKey: methods.card.secretKey || undefined,
        cardMerchantId: methods.card.merchantId,
      };

      await paymentSettingsApi.update(condominiumId, requestData);
      toastSuccess(t('condoSettings.saveSuccess'));
      
      // Reload to get updated values without secret key
      await loadPaymentSettings();
      return true;
    } catch (error: unknown) {
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? t('condoSettings.payments.saveErrorToast')
          : t('condoSettings.payments.saveErrorToast');
      console.error('Error saving payment settings:', error);
      toastError(errorMessage);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleMethod = (method: 'bankTransfer' | 'mbReference' | 'mbWay' | 'card', enabled: boolean) => {
    setMethods((prev) => ({
      ...prev,
      [method]: {
        ...prev[method],
        enabled,
      },
    }));

    if (enabled) {
      setActiveMethodModal(method);
    } else if (activeMethodModal === method) {
      setActiveMethodModal(null);
    }
  };

  const saveAndCloseMethodModal = async () => {
    const saved = await handleSave();
    if (saved) {
      setActiveMethodModal(null);
    }
  };

  // Only admins (regular or internal) can access payment methods
  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-ink-subtle">
        <p>{t('condoSettings.payments.adminOnly')}</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-8 text-ink-subtle"><Spinner label={t('condoSettings.loading')} /></div>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      )}

      <div>
        <h3 className="text-lg font-semibold text-ink mb-1">{t('condoSettings.payments.title')}</h3>
        <p className="text-sm text-ink-subtle">{t('condoSettings.payments.subtitle')}</p>
      </div>

      <div className="space-y-4 max-w-3xl">
        {/* Transferência Bancária */}
        <div className="border border-line rounded-lg overflow-hidden">
          <div className="p-4 bg-surface">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-ink">{t('condoSettings.payments.bankTransfer')}</p>
                  {methods.bankTransfer.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">{t('common.active')}</span>
                  )}
                </div>
                <p className="text-sm text-ink-subtle">{t('condoSettings.payments.bankTransferDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={methods.bankTransfer.enabled}
                  onChange={(e) => toggleMethod('bankTransfer', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
          {methods.bankTransfer.enabled && (
            <div className="px-4 pb-4 bg-surface-muted border-t border-line flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">{t('condoSettings.payments.ibanValue', { value: methods.bankTransfer.iban || t('condoSettings.notConfiguredM') })}</p>
                <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.payments.holderValue', { value: methods.bankTransfer.accountHolder || t('condoSettings.notConfiguredM') })}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMethodModal('bankTransfer')}
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                {t('condoSettings.configure')}
              </button>
            </div>
          )}
        </div>

        {/* Referência Multibanco */}
        <div className="border border-line rounded-lg overflow-hidden">
          <div className="p-4 bg-surface">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-ink">{t('condoSettings.payments.mbReference')}</p>
                  {methods.mbReference.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">{t('common.active')}</span>
                  )}
                </div>
                <p className="text-sm text-ink-subtle">{t('condoSettings.payments.mbReferenceDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={methods.mbReference.enabled}
                  onChange={(e) => toggleMethod('mbReference', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
          
          {methods.mbReference.enabled && (
            <div className="px-4 pb-4 bg-surface-muted border-t border-line flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">{t('condoSettings.payments.entityValue', { value: methods.mbReference.entity || t('condoSettings.notConfiguredM') })}</p>
                <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.payments.referenceValue', { value: methods.mbReference.reference || t('condoSettings.notConfiguredF') })}</p>
              </div>
              <button type="button" onClick={() => setActiveMethodModal('mbReference')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">{t('condoSettings.configure')}</button>
            </div>
          )}
        </div>

        {/* MB Way */}
        <div className="border border-line rounded-lg overflow-hidden">
          <div className="p-4 bg-surface">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-ink">MB Way</p>
                  {methods.mbWay.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Ativo</span>
                  )}
                </div>
                <p className="text-sm text-ink-subtle">{t('condoSettings.payments.mbWayDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={methods.mbWay.enabled}
                  onChange={(e) => toggleMethod('mbWay', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
          
          {methods.mbWay.enabled && (
            <div className="px-4 pb-4 bg-surface-muted border-t border-line flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">{t('condoSettings.payments.phoneValue', { value: methods.mbWay.phoneNumber || t('condoSettings.notConfiguredM') })}</p>
                <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.payments.merchantIdValue', { value: methods.mbWay.merchantId || t('condoSettings.notConfiguredM') })}</p>
              </div>
              <button type="button" onClick={() => setActiveMethodModal('mbWay')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">{t('condoSettings.configure')}</button>
            </div>
          )}
        </div>

        {/* Cartão de Crédito/Débito */}
        <div className="border border-line rounded-lg overflow-hidden">
          <div className="p-4 bg-surface">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-ink">{t('condoSettings.payments.card')}</p>
                  {methods.card.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">{t('common.active')}</span>
                  )}
                </div>
                <p className="text-sm text-ink-subtle">{t('condoSettings.payments.cardDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={methods.card.enabled}
                  onChange={(e) => toggleMethod('card', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
          
          {methods.card.enabled && (
            <div className="px-4 pb-4 bg-surface-muted border-t border-line flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">{t('condoSettings.payments.gatewayValue', { value: methods.card.provider || t('condoSettings.notConfiguredM') })}</p>
                <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.payments.merchantIdValue', { value: methods.card.merchantId || t('condoSettings.notConfiguredM') })}</p>
              </div>
              <button type="button" onClick={() => setActiveMethodModal('card')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">{t('condoSettings.configure')}</button>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button icon={Save} onClick={handleSave} loading={saving}>
            {t('condoSettings.saveSettings')}
          </Button>
        </div>
      </div>

      <ModalPopup
        open={activeMethodModal !== null}
        onClose={() => setActiveMethodModal(null)}
        title={
          activeMethodModal === 'bankTransfer'
            ? t('condoSettings.payments.modalBankTransfer')
            : activeMethodModal === 'mbReference'
              ? t('condoSettings.payments.modalMbReference')
              : activeMethodModal === 'mbWay'
                ? t('condoSettings.payments.modalMbWay')
                : t('condoSettings.payments.modalCard')
        }
        maxWidthClass="max-w-2xl"
      >
        {activeMethodModal === 'bankTransfer' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">IBAN <span className="text-red-500">*</span></label>
              <input type="text" value={methods.bankTransfer.iban} onChange={(e) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer, iban: e.target.value } })} placeholder="PT50 0000 0000 0000 0000 0000 0" className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.payments.accountHolder')} <span className="text-red-500">*</span></label>
              <input type="text" value={methods.bankTransfer.accountHolder} onChange={(e) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer, accountHolder: e.target.value } })} placeholder={t('condoSettings.payments.condoNamePlaceholder')} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        {activeMethodModal === 'mbReference' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900 font-medium mb-1">{t('condoSettings.payments.mbRefHelpTitle')}</p>
              <p className="text-xs text-blue-700">{t('condoSettings.payments.mbRefHelpDesc')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.payments.entity')} <span className="text-red-500">*</span></label>
                <input type="text" value={methods.mbReference.entity} onChange={(e) => setMethods({ ...methods, mbReference: { ...methods.mbReference, entity: e.target.value } })} placeholder="12345" maxLength={5} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.payments.fiveDigits')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.payments.baseReference')} <span className="text-ink-subtle">{t('condoSettings.optional')}</span></label>
                <input type="text" value={methods.mbReference.reference} onChange={(e) => setMethods({ ...methods, mbReference: { ...methods.mbReference, reference: e.target.value } })} placeholder="999 999 999" maxLength={9} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.payments.nineDigits')}</p>
              </div>
            </div>
          </div>
        )}

        {activeMethodModal === 'mbWay' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900 font-medium mb-1">{t('condoSettings.payments.mbWayReqTitle')}</p>
              <p className="text-xs text-blue-700">{t('condoSettings.payments.mbWayReqDesc')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.payments.condoPhoneNumber')} <span className="text-red-500">*</span></label>
              <input type="tel" value={methods.mbWay.phoneNumber} onChange={(e) => setMethods({ ...methods, mbWay: { ...methods.mbWay, phoneNumber: e.target.value } })} placeholder="+351 912 345 678" className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.payments.mbWayPhoneHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Merchant ID / API Key <span className="text-red-500">*</span></label>
              <input type="text" value={methods.mbWay.merchantId} onChange={(e) => setMethods({ ...methods, mbWay: { ...methods.mbWay, merchantId: e.target.value } })} placeholder={t('condoSettings.payments.providedByGateway')} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        {activeMethodModal === 'card' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900 font-medium mb-1">{t('condoSettings.payments.cardReqTitle')}</p>
              <p className="text-xs text-blue-700">{t('condoSettings.payments.cardReqDesc')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.payments.paymentGateway')} <span className="text-red-500">*</span></label>
              <select value={methods.card.provider} onChange={(e) => setMethods({ ...methods, card: { ...methods.card, provider: e.target.value } })} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="stripe">Stripe</option><option value="easypay">Easypay</option><option value="sibs">SIBS</option><option value="paypal">PayPal</option><option value="ifthenpay">IfthenPay</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Public/Publishable Key <span className="text-red-500">*</span></label>
              <input type="text" value={methods.card.publicKey} onChange={(e) => setMethods({ ...methods, card: { ...methods.card, publicKey: e.target.value } })} placeholder="pk_live_..." className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Secret/API Key <span className="text-red-500">*</span></label>
              <input type="password" value={methods.card.secretKey} onChange={(e) => setMethods({ ...methods, card: { ...methods.card, secretKey: e.target.value } })} placeholder={t('condoSettings.payments.secretKeyPlaceholder')} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.payments.secretKeyHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Merchant ID</label>
              <input type="text" value={methods.card.merchantId} onChange={(e) => setMethods({ ...methods, card: { ...methods.card, merchantId: e.target.value } })} placeholder={t('condoSettings.payments.merchantIdPlaceholder')} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-line flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => setActiveMethodModal(null)} className="border border-line">{t('condoSettings.close')}</Button>
          <Button icon={Save} onClick={saveAndCloseMethodModal} loading={saving}>{t('condoSettings.saveSettings')}</Button>
        </div>
      </ModalPopup>
    </div>
  );
}

function CommunicationChannelsContent() {
  const { condominiumId } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();
  const [activeChannelModal, setActiveChannelModal] = useState<'email' | 'whatsApp' | null>(null);
  const [settings, setSettings] = useState<CommunicationSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showWhatsAppKey, setShowWhatsAppKey] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [whatsAppApiKey, setWhatsAppApiKey] = useState('');

  const loadSettings = useCallback(async () => {
    if (!condominiumId) return;
    try {
      setLoading(true);
      setLoadError('');
      const response = await communicationSettingsApi.get(condominiumId);
      setSettings(response.data);
    } catch (error) {
      console.error('Error loading communication settings:', error);
      setLoadError(t('condoSettings.comm.errorLoad'));
      toastError(t('condoSettings.comm.errorLoadToast'));
    } finally {
      setLoading(false);
    }
  }, [condominiumId, toastError, t]);

  useEffect(() => {
    if (condominiumId) {
      loadSettings();
    }
  }, [condominiumId, loadSettings]);

  const handleSave = async (): Promise<boolean> => {
    if (!condominiumId || !settings) return false;
    
    try {
      setSaving(true);
      
      const request: UpdateCommunicationSettingsRequest = {
        emailEnabled: settings.emailEnabled,
        emailSmtpHost: settings.emailSmtpHost,
        emailSmtpPort: settings.emailSmtpPort,
        emailUsername: settings.emailUsername,
        emailPassword: emailPassword || undefined,
        emailUseSsl: settings.emailUseSsl,
        whatsAppEnabled: settings.whatsAppEnabled,
        whatsAppPhoneNumber: settings.whatsAppPhoneNumber,
        whatsAppApiKey: whatsAppApiKey || undefined,
        whatsAppApiProvider: settings.whatsAppApiProvider,
        whatsAppGroupId: settings.whatsAppGroupId,
        smsEnabled: settings.smsEnabled,
        smsProvider: settings.smsProvider,
        smsFromNumber: settings.smsFromNumber,
        allowAnnouncementComments: settings.allowAnnouncementComments,
      };
      
      await communicationSettingsApi.update(condominiumId, request);
      toastSuccess(t('condoSettings.saveSuccess'));
      return true;
    } catch (error) {
      console.error('Error saving communication settings:', error);
      toastError(t('condoSettings.comm.saveError'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (channel: 'email' | 'whatsApp', enabled: boolean) => {
    setSettings((prev) => {
      if (!prev) return prev;

      if (channel === 'email') {
        return { ...prev, emailEnabled: enabled };
      }

      return { ...prev, whatsAppEnabled: enabled };
    });

    if (enabled) {
      setActiveChannelModal(channel);
    } else if (activeChannelModal === channel) {
      setActiveChannelModal(null);
    }
  };

  const saveAndCloseChannelModal = async () => {
    const saved = await handleSave();
    if (saved) {
      setActiveChannelModal(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8 text-ink-subtle"><Spinner label={t('condoSettings.loading')} /></div>;
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      )}

      <div>
        <h3 className="text-lg font-semibold text-ink mb-1">{t('condoSettings.comm.title')}</h3>
        <p className="text-sm text-ink-subtle">{t('condoSettings.comm.subtitle')}</p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Announcements Configuration */}
        <div className="border border-line rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">{t('condoSettings.comm.announcements')}</p>
              <p className="text-sm text-ink-subtle">{t('condoSettings.comm.announcementsDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowAnnouncementComments}
                onChange={(e) => setSettings({ ...settings, allowAnnouncementComments: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          <p className="text-xs text-ink-subtle">
            {t('condoSettings.comm.announcementsHint')}
          </p>
        </div>

        {/* Email Configuration */}
        <div className="border border-line rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">Email (SMTP)</p>
              <p className="text-sm text-ink-subtle">{t('condoSettings.comm.emailDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailEnabled}
                onChange={(e) => toggleChannel('email', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {settings.emailEnabled && (
            <div className="pt-3 border-t border-line flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">{t('condoSettings.comm.smtpValue', { value: settings.emailSmtpHost || t('condoSettings.notConfiguredM') })}</p>
                <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.comm.usernameValue', { value: settings.emailUsername || t('condoSettings.notConfiguredM') })}</p>
              </div>
              <button type="button" onClick={() => setActiveChannelModal('email')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">{t('condoSettings.configure')}</button>
            </div>
          )}
        </div>

        {/* WhatsApp Configuration */}
        <div className="border border-line rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">WhatsApp Business</p>
              <p className="text-sm text-ink-subtle">{t('condoSettings.comm.whatsAppDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.whatsAppEnabled}
                onChange={(e) => toggleChannel('whatsApp', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {settings.whatsAppEnabled && (
            <div className="pt-3 border-t border-line flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">{t('condoSettings.comm.numberValue', { value: settings.whatsAppPhoneNumber || t('condoSettings.notConfiguredM') })}</p>
                <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.comm.providerValue', { value: settings.whatsAppApiProvider || t('condoSettings.notConfiguredM') })}</p>
              </div>
              <button type="button" onClick={() => setActiveChannelModal('whatsApp')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">{t('condoSettings.configure')}</button>
            </div>
          )}
        </div>

        {/* SMS Configuration (Disabled for now) */}
        <div className="border border-line rounded-lg p-5 opacity-60">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">SMS</p>
              <p className="text-sm text-ink-subtle">{t('condoSettings.comm.smsDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-not-allowed">
              <input
                type="checkbox"
                checked={false}
                disabled
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 pt-4">
          <Button icon={Save} onClick={handleSave} loading={saving} className="px-6 py-2.5">
            {t('condoSettings.saveSettings')}
          </Button>
        </div>
      </div>

      <ModalPopup
        open={activeChannelModal !== null}
        onClose={() => setActiveChannelModal(null)}
        title={activeChannelModal === 'email' ? t('condoSettings.comm.modalEmail') : t('condoSettings.comm.modalWhatsApp')}
        maxWidthClass="max-w-3xl"
      >
        {activeChannelModal === 'email' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.comm.smtpServer')} <span className="text-ink-subtle font-normal ml-1">{t('condoSettings.comm.smtpServerHint')}</span></label>
                <input type="text" value={settings.emailSmtpHost || ''} onChange={(e) => setSettings({ ...settings, emailSmtpHost: e.target.value })} placeholder="smtp.gmail.com" className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.comm.port')} <span className="text-ink-subtle font-normal ml-1">{t('condoSettings.comm.portHint')}</span></label>
                <input type="number" value={settings.emailSmtpPort || 587} onChange={(e) => setSettings({ ...settings, emailSmtpPort: parseInt(e.target.value, 10) || 0 })} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">Email / Username</label>
                <input type="text" value={settings.emailUsername || ''} onChange={(e) => setSettings({ ...settings, emailUsername: e.target.value })} placeholder="condominio@gmail.com" className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">Password / App Password</label>
                <div className="relative">
                  <input type={showEmailPassword ? 'text' : 'password'} value={emailPassword} placeholder={t('condoSettings.comm.keepIfEmpty')} onChange={(e) => setEmailPassword(e.target.value)} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="button" onClick={() => setShowEmailPassword(!showEmailPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-xs">{showEmailPassword ? t('condoSettings.hide') : t('condoSettings.show')}</button>
                </div>
                <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.comm.gmailHint')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="emailUseSslModal" checked={settings.emailUseSsl} onChange={(e) => setSettings({ ...settings, emailUseSsl: e.target.checked })} className="w-4 h-4 text-indigo-600 border-line rounded focus:ring-indigo-500" />
              <label htmlFor="emailUseSslModal" className="text-sm text-ink-muted">{t('condoSettings.useSsl')}</label>
            </div>
          </div>
        )}

        {activeChannelModal === 'whatsApp' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.comm.whatsAppNumber')}</label>
                <input type="tel" value={settings.whatsAppPhoneNumber || ''} onChange={(e) => setSettings({ ...settings, whatsAppPhoneNumber: e.target.value })} placeholder="+351 912 345 678" className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.comm.apiProvider')}</label>
                <select value={settings.whatsAppApiProvider || ''} onChange={(e) => setSettings({ ...settings, whatsAppApiProvider: e.target.value })} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">{t('condoSettings.select')}</option>
                  <option value="twilio">Twilio</option>
                  <option value="whatsapp-business-api">WhatsApp Business API</option>
                  <option value="360dialog">360dialog</option>
                  <option value="other">{t('condoSettings.other')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">API Key / Token</label>
              <div className="relative">
                <input type={showWhatsAppKey ? 'text' : 'password'} value={whatsAppApiKey} placeholder={t('condoSettings.comm.keepIfEmpty')} onChange={(e) => setWhatsAppApiKey(e.target.value)} className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="button" onClick={() => setShowWhatsAppKey(!showWhatsAppKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-xs">{showWhatsAppKey ? t('condoSettings.hide') : t('condoSettings.show')}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.comm.whatsAppGroupId')} <span className="text-ink-subtle font-normal ml-1">{t('condoSettings.optional')}</span></label>
              <input type="text" value={settings.whatsAppGroupId || ''} onChange={(e) => setSettings({ ...settings, whatsAppGroupId: e.target.value })} placeholder="120363xxxxx@g.us" className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-ink-subtle mt-1">{t('condoSettings.comm.whatsAppGroupHint')}</p>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-line flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => setActiveChannelModal(null)} className="border border-line">{t('condoSettings.close')}</Button>
          <Button icon={Save} onClick={saveAndCloseChannelModal} loading={saving}>{t('condoSettings.saveSettings')}</Button>
        </div>
      </ModalPopup>
    </div>
  );
}


function SystemEmailContent() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SystemEmailSettingsDto | null>(null);
  const [form, setForm] = useState<UpdateSystemEmailSettingsRequest>({
    emailEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    username: '',
    password: '',
    useSsl: true,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await systemEmailSettingsApi.get();
        setSettings(response.data);
        setForm({
          emailEnabled: response.data.emailEnabled,
          smtpHost: response.data.smtpHost || '',
          smtpPort: response.data.smtpPort || 587,
          username: response.data.username || '',
          password: '',
          useSsl: response.data.useSsl,
        });
      } catch (error) {
        console.error('Erro ao carregar configurações de email do sistema:', error);
        setLoadError(t('condoSettings.systemEmail.errorLoad'));
        toastError(t('condoSettings.systemEmail.errorLoadToast'));
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [toastError, t]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await systemEmailSettingsApi.update(form);
      setSettings(response.data);
      setForm((prev) => ({ ...prev, password: '' }));
      toastSuccess(t('condoSettings.systemEmail.saveSuccess'));
    } catch (error) {
      console.error('Erro ao guardar configurações de email do sistema:', error);
      toastError(t('condoSettings.systemEmail.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await systemEmailSettingsApi.test();
      toastSuccess(response.data.message);
    } catch (error) {
      console.error('Erro ao testar configurações de email:', error);
      toastError(t('condoSettings.systemEmail.testError'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8 text-ink-subtle"><Spinner label={t('condoSettings.loading')} /></div>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      )}

      <div>
        <h3 className="text-lg font-semibold text-ink mb-1">{t('condoSettings.systemEmail.title')}</h3>
        <p className="text-sm text-ink-subtle">
          {t('condoSettings.systemEmail.subtitle')}
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-900 font-medium mb-1">{t('condoSettings.systemEmail.compareTitle')}</p>
        <p className="text-xs text-blue-700">
          {t('condoSettings.systemEmail.compareDesc')}
        </p>
      </div>

      <div className="space-y-4 max-w-3xl">
        <div className="border border-line rounded-lg overflow-hidden">
          <div className="p-4 bg-surface">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-ink">{t('condoSettings.systemEmail.enabledTitle')}</p>
                  {form.emailEnabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">{t('common.active')}</span>
                  )}
                </div>
                <p className="text-sm text-ink-subtle">{t('condoSettings.systemEmail.enabledDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={form.emailEnabled}
                  onChange={(e) => setForm({ ...form, emailEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="px-4 pb-4 bg-surface-muted border-t border-line space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.comm.smtpServer')}</label>
                <input
                  type="text"
                  value={form.smtpHost || ''}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  placeholder="smtp.exemplo.com"
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.comm.port')}</label>
                <input
                  type="number"
                  value={form.smtpPort}
                  onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) || 587 })}
                  placeholder="587"
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.systemEmail.user')}</label>
              <input
                type="text"
                value={form.username || ''}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="no-reply@habituscond.pt"
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('condoSettings.systemEmail.password')}</label>
              <input
                type="password"
                value={form.password || ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={settings?.hasPassword ? t('condoSettings.billing.secretConfiguredPlaceholder') : t('condoSettings.systemEmail.passwordPlaceholder')}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useSsl"
                checked={form.useSsl}
                onChange={(e) => setForm({ ...form, useSsl: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-line rounded focus:ring-indigo-500"
              />
              <label htmlFor="useSsl" className="text-sm text-ink-muted">{t('condoSettings.useSsl')}</label>
            </div>

            {settings && (
              <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <p className="text-ink-subtle">{t('condoSettings.systemEmail.password')}</p>
                <p className="font-medium text-ink">{settings.hasPassword ? t('condoSettings.billing.configuredF') : t('condoSettings.notConfiguredF')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button icon={Save} onClick={handleSave} loading={saving}>
            {t('condoSettings.saveSettings')}
          </Button>
          <Button
            variant="ghost"
            onClick={handleTest}
            loading={testing}
            disabled={!form.emailEnabled}
            className="border border-line"
          >
            {t('condoSettings.systemEmail.testButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}

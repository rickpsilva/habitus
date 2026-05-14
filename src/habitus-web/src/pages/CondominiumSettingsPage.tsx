import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Warehouse, Truck, Home, FileText, CreditCard, Mail, Save, KeyRound, RefreshCw, Server
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { marked } from 'marked';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ModalPopup from '../components/ModalPopup';
import RichTextEditor, { type RichTextTokenDefinition } from '../components/RichTextEditor';
import { paymentSettingsApi, communicationSettingsApi, platformBillingSettingsApi, condominiumsApi, systemEmailSettingsApi, receiptTemplateSettingsApi } from '../api/services';
import type {
  CommunicationSettingsDto,
  UpdateCommunicationSettingsRequest,
  PlatformBillingSettingsDto,
  UpdatePlatformBillingSettingsRequest,
  SystemEmailSettingsDto,
  UpdateSystemEmailSettingsRequest,
} from '../types';
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

type TabKey = 'general' | 'spaces' | 'suppliers' | 'units' | 'receipts' | 'payments' | 'communication' | 'platform-billing' | 'system-email';

interface Tab {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

const adminTabs: Tab[] = [
  { key: 'general', label: 'Geral', icon: Home },
  { key: 'spaces', label: 'Espaços Comuns', icon: Warehouse },
  { key: 'suppliers', label: 'Fornecedores', icon: Truck },
  { key: 'units', label: 'Frações', icon: Home },
  { key: 'receipts', label: 'Template Recibos', icon: FileText },
  { key: 'payments', label: 'Métodos de Pagamento', icon: CreditCard },
  { key: 'communication', label: 'Canais de Comunicação', icon: Mail },
];

const managerTabs: Tab[] = [
  { key: 'platform-billing', label: 'Gateway de Pagamento', icon: KeyRound },
  { key: 'system-email', label: 'Email de Sistema', icon: Server },
];

export default function CondominiumSettingsPage() {
  const { isAdmin, isManager } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleTabs = isManager ? managerTabs : adminTabs;

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
        <p className="text-gray-500">Acesso apenas para gestão</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isManager ? 'Configurações da Plataforma' : 'Configuração do Condomínio'}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {isManager ? 'Gerir configurações globais da plataforma' : 'Gerir todas as configurações do condomínio'}
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
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
          {activeTab === 'system-email' && <SystemEmailContent />}
        </div>
      </div>
    </div>
  );
}

function GeneralCondominiumContent() {
  const { condominiumId } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [condominiumData, setCondominiumData] = useState<{ name: string; address: string; taxId: string; isActive: boolean } | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [condominiumName, setCondominiumName] = useState('');

  useEffect(() => {
    const loadCondominium = async () => {
      if (!condominiumId) return;
      setLoading(true);
      try {
        const response = await condominiumsApi.getById(condominiumId);
        setCondominiumName(response.data.name);
        setEmail(response.data.email || '');
        setCondominiumData({
          name: response.data.name,
          address: response.data.address,
          taxId: response.data.taxId,
          isActive: response.data.isActive,
        });
      } catch (error) {
        console.error('Error loading condominium data:', error);
        toastError('Erro ao carregar dados do condomínio.');
      } finally {
        setLoading(false);
      }
    };

    loadCondominium();
  }, [condominiumId, toastError]);

  const handleSave = async () => {
    if (!condominiumId || !condominiumData) return;
    setSaving(true);
    try {
      await condominiumsApi.update(condominiumId, {
        id: condominiumId,
        name: condominiumData.name,
        address: condominiumData.address,
        taxId: condominiumData.taxId,
        email: email.trim() || '',
        isActive: condominiumData.isActive,
      });
      toastSuccess('Email do condomínio guardado com sucesso!');
    } catch (error) {
      console.error('Error saving condominium email:', error);
      toastError('Erro ao guardar email do condomínio.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">A carregar...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Dados Gerais</h3>
        <p className="text-sm text-gray-500">Gerir o email de contacto visível aos moradores e usado nas notificações de faturação</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="border border-gray-200 rounded-lg p-5 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condomínio</label>
            <input
              type="text"
              value={condominiumName}
              disabled
              className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email do Condomínio</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="geral@condominio.pt"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Este email aparece no perfil dos utilizadores e é usado como contacto do condomínio.</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {saving ? 'A guardar...' : 'Guardar Email'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlatformBillingContent() {
  const { success: toastSuccess, error: toastError } = useToast();
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
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
        toastError('Erro ao carregar configurações do gateway.');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [toastError]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await platformBillingSettingsApi.update(form);
      setSettings(response.data);
      setForm((prev) => ({ ...prev, secretKey: '', webhookSecret: '' }));
      toastSuccess('Configurações do gateway guardadas com sucesso!');
    } catch (error) {
      console.error('Error saving platform billing settings:', error);
      toastError('Erro ao guardar configurações do gateway.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />A carregar...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Gateway de Pagamento</h3>
        <p className="text-sm text-gray-500">Configure o provider e as credenciais do checkout global da plataforma</p>
      </div>

      <div className="space-y-4 max-w-3xl">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">Checkout da Plataforma</p>
                  {form.gatewayEnabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Ativo</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">Usado no pagamento online das faturas de subscrição</p>
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

          <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-blue-900 font-medium mb-1">Configuração global</p>
              <p className="text-xs text-blue-700">
                Estas credenciais pertencem à plataforma Habitus e não às definições individuais de cada condomínio.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={form.gatewayProvider}
                onChange={(e) => setForm({ ...form, gatewayProvider: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="stripe">Stripe</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Public Key</label>
              <input
                type="text"
                value={form.publicKey || ''}
                onChange={(e) => setForm({ ...form, publicKey: e.target.value })}
                placeholder="pk_live_..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Display Name</label>
              <input
                type="text"
                value={form.merchantDisplayName || ''}
                onChange={(e) => setForm({ ...form, merchantDisplayName: e.target.value })}
                placeholder="Habitus Billing"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
              <input
                type="password"
                value={form.secretKey || ''}
                onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                placeholder={settings?.hasSecretKey ? 'Já configurada. Preencha para substituir.' : 'sk_live_...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
              <input
                type="password"
                value={form.webhookSecret || ''}
                onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                placeholder={settings?.hasWebhookSecret ? 'Já configurado. Preencha para substituir.' : 'whsec_...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                <p className="text-gray-500">Secret Key</p>
                <p className="font-medium text-gray-900">{settings?.hasSecretKey ? 'Configurada' : 'Em falta'}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                <p className="text-gray-500">Webhook Secret</p>
                <p className="font-medium text-gray-900">{settings?.hasWebhookSecret ? 'Configurado' : 'Em falta'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {saving ? 'A guardar...' : 'Guardar Configurações'}
          </button>
        </div>
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
  const [activeTemplateType, setActiveTemplateType] = useState<'monthlyFee' | 'monthlyFeeQuarterly' | 'monthlyFeeAnnual' | 'reservation' | 'other'>('monthlyFee');
  const [template, setTemplate] = useState({
    companyName: '',
    address: '',
    postalCode: '',
    locality: '',
    taxId: '',
    email: '',
    phone: '',
    template: '',
    templateMonthlyFee: '',
    templateMonthlyFeeQuarterly: '',
    templateMonthlyFeeAnnual: '',
    templateExtraordinaryFee: '',
    templateReservation: '',
    templateOther: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tagDefinitions: RichTextTokenDefinition[] = useMemo(() => [
    {
      token: '{resident_name}',
      label: 'Nome do pagador',
      description: 'Nome do residente ou admin interno que criou o pagamento.',
      example: 'Joana Silva',
      missingBehavior: 'Fica vazio.',
      category: 'Pagador',
    },
    {
      token: '{unit_number}',
      label: 'Número da fração',
      description: 'Número ou identificador principal da fração.',
      example: 'A-12',
      missingBehavior: 'Fica vazio.',
      category: 'Fração',
    },
    {
      token: '{unit_port}',
      label: 'Piso / porta',
      description: 'Piso associado à fração.',
      example: '3',
      missingBehavior: 'Fica vazio.',
      category: 'Fração',
    },
    {
      token: '{unit_build}',
      label: 'Nome do condomínio',
      description: 'Nome do condomínio associado ao pagamento.',
      example: 'Condomínio Jardins do Sol',
      missingBehavior: 'Fica vazio.',
      category: 'Condomínio',
    },
    {
      token: '{value_amount}',
      label: 'Valor pago',
      description: 'Valor monetário do pagamento formatado em euros.',
      example: '75.00',
      missingBehavior: 'Fica 0.00 se não existir valor.',
      category: 'Pagamento',
    },
    {
      token: '{quote_period_month_start}',
      label: 'Mês inicial do período',
      description: 'Mês inicial do período da quota.',
      example: 'janeiro',
      missingBehavior: 'Fica vazio até existirem campos estruturados de período.',
      category: 'Quota',
    },
    {
      token: '{quote_period_month_end}',
      label: 'Mês final do período',
      description: 'Mês final do período da quota.',
      example: 'março',
      missingBehavior: 'Fica vazio até existirem campos estruturados de período.',
      category: 'Quota',
    },
    {
      token: '{quote_period_month}',
      label: 'Mês do período mensal',
      description: 'Mês da quota quando o pagamento é mensal.',
      example: 'janeiro',
      missingBehavior: 'Fica vazio quando o pagamento não é mensal.',
      category: 'Quota',
    },
    {
      token: '{current_day}',
      label: 'Dia atual',
      description: 'Dia da emissão do recibo.',
      example: '13',
      missingBehavior: 'Usa a data atual.',
      category: 'Data',
    },
    {
      token: '{current_month}',
      label: 'Mês atual',
      description: 'Mês por extenso da emissão do recibo.',
      example: 'maio',
      missingBehavior: 'Usa a data atual.',
      category: 'Data',
    },
    {
      token: '{current_year}',
      label: 'Ano atual',
      description: 'Ano da emissão do recibo.',
      example: '2026',
      missingBehavior: 'Usa a data atual.',
      category: 'Data',
    },
  ], []);

  const templateTypeOptions = [
    { key: 'monthlyFee', label: 'Quotas - Mensal' },
    { key: 'monthlyFeeQuarterly', label: 'Quotas - Trimestral' },
    { key: 'monthlyFeeAnnual', label: 'Quotas - Anual' },
    { key: 'reservation', label: 'Reservas' },
    { key: 'other', label: 'Outros' },
  ] as const;

  const templateFieldByType = {
    monthlyFee: 'templateMonthlyFee',
    monthlyFeeQuarterly: 'templateMonthlyFeeQuarterly',
    monthlyFeeAnnual: 'templateMonthlyFeeAnnual',
    reservation: 'templateReservation',
    other: 'templateOther',
  } as const;

  const activeTemplateField = templateFieldByType[activeTemplateType];
  const knownTagTokens = new Set(tagDefinitions.map((definition) => definition.token.toLowerCase()));
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
      try {
        const response = await receiptTemplateSettingsApi.get(condominiumId);
        setTemplate({
          companyName: response.data.companyName || '',
          address: response.data.address || '',
          postalCode: response.data.postalCode || '',
          locality: response.data.locality || '',
          taxId: response.data.taxId || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
          template: response.data.template || '',
          templateMonthlyFee: templateToEditorHtml(response.data.templateMonthlyFee || response.data.template || ''),
          templateMonthlyFeeQuarterly: templateToEditorHtml(response.data.templateMonthlyFeeQuarterly || response.data.templateMonthlyFee || response.data.template || ''),
          templateMonthlyFeeAnnual: templateToEditorHtml(response.data.templateMonthlyFeeAnnual || response.data.templateMonthlyFeeQuarterly || response.data.templateMonthlyFee || response.data.template || ''),
          templateExtraordinaryFee: templateToEditorHtml(response.data.templateExtraordinaryFee || response.data.template || ''),
          templateReservation: templateToEditorHtml(response.data.templateReservation || response.data.template || ''),
          templateOther: templateToEditorHtml(response.data.templateOther || response.data.template || ''),
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

        const errorMessage =
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Erro ao carregar template de recibos.'
            : 'Erro ao carregar template de recibos.';
        toastError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [condominiumId, toastError]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!condominiumId) return;

    setSaving(true);
    try {
      await receiptTemplateSettingsApi.update(condominiumId, {
        companyName: template.companyName || undefined,
        address: template.address || undefined,
        postalCode: template.postalCode || undefined,
        locality: template.locality || undefined,
        taxId: template.taxId || undefined,
        email: template.email || undefined,
        phone: template.phone || undefined,
        template: template.templateMonthlyFee || template.template || undefined,
        templateMonthlyFee: template.templateMonthlyFee || undefined,
        templateMonthlyFeeQuarterly: template.templateMonthlyFeeQuarterly || undefined,
        templateMonthlyFeeAnnual: template.templateMonthlyFeeAnnual || undefined,
        templateExtraordinaryFee: template.templateExtraordinaryFee || undefined,
        templateReservation: template.templateReservation || undefined,
        templateOther: template.templateOther || undefined,
      });
      toastSuccess('Template de recibos guardado com sucesso!');
    } catch (error) {
      console.error('Error saving receipt template settings:', error);
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number; data?: { message?: string } } }).response?.status === 'number' &&
        (error as { response?: { status?: number; data?: { message?: string } } }).response?.status === 404
          ? 'Endpoint de template de recibos não encontrado na API. Reinicie/atualize o backend.'
          : typeof error === 'object' &&
              error !== null &&
              'response' in error &&
              typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Erro ao guardar template de recibos.'
            : 'Erro ao guardar template de recibos.';
      toastError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">A carregar...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Template de Recibos</h3>
        <p className="text-sm text-gray-500">Configure as informações que aparecem nos recibos gerados</p>
      </div>

      <form className="space-y-4 max-w-2xl" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
            <input
              type="text"
              value={template.companyName}
              onChange={(e) => setTemplate({ ...template, companyName: e.target.value })}
              placeholder="Condominio Jardins do Sol"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NIPC</label>
            <input
              type="text"
              value={template.taxId}
              onChange={(e) => setTemplate({ ...template, taxId: e.target.value })}
              placeholder="509876543"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Morada</label>
          <input
            type="text"
            value={template.address}
            onChange={(e) => setTemplate({ ...template, address: e.target.value })}
            placeholder="Rua das Flores, 120, 4000-123 Porto"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
            <input
              type="text"
              value={template.postalCode}
              onChange={(e) => setTemplate({ ...template, postalCode: e.target.value })}
              placeholder="4000-123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Localidade</label>
            <input
              type="text"
              value={template.locality}
              onChange={(e) => setTemplate({ ...template, locality: e.target.value })}
              placeholder="Porto"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={template.email}
              onChange={(e) => setTemplate({ ...template, email: e.target.value })}
              placeholder="geral@jardinsdosol.pt"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="tel"
              value={template.phone}
              onChange={(e) => setTemplate({ ...template, phone: e.target.value })}
              placeholder="+351 220 000 000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {templateTypeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveTemplateType(option.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTemplateType === option.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
          <RichTextEditor 
            value={template[activeTemplateField]}
            onChange={(v) => setTemplate({ ...template, [activeTemplateField]: v })}
            placeholder="Escreva o conteúdo do recibo e use as tags disponíveis para preencher os dados automaticamente."
            height="240px"
            tokenDefinitions={tagDefinitions}
          />
          {unknownTags.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="font-medium">Existem tags desconhecidas no template.</p>
              <p className="mt-1 text-xs">Pode guardar na mesma, mas estas tags não serão preenchidas automaticamente: {unknownTags.join(', ')}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {saving ? 'A guardar...' : 'Guardar Template'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PaymentMethodsContent() {
  const { condominiumId, isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  
  // Only admins (regular or internal) can access payment methods
  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Acesso apenas para Administrador</p>
      </div>
    );
  }
  
  const [activeMethodModal, setActiveMethodModal] = useState<'bankTransfer' | 'mbReference' | 'mbWay' | 'card' | null>(null);
  const [loading, setLoading] = useState(false);
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
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Erro ao carregar configurações'
          : 'Erro ao carregar configurações';
      console.error('Error loading payment settings:', error);
      toastError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [condominiumId, toastError]);

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
      toastSuccess('Configurações guardadas com sucesso!');
      
      // Reload to get updated values without secret key
      await loadPaymentSettings();
      return true;
    } catch (error: unknown) {
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Erro ao guardar configurações'
          : 'Erro ao guardar configurações';
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

  if (loading) {
    return <div className="text-center py-8 text-gray-500">A carregar...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Métodos de Pagamento</h3>
        <p className="text-sm text-gray-500">Configure os métodos de pagamento disponíveis para os residentes</p>
      </div>

      <div className="space-y-4 max-w-3xl">
        {/* Transferência Bancária */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">Transferência Bancária</p>
                  {methods.bankTransfer.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Ativo</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">Pagamento via transferência bancária tradicional</p>
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
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-700">IBAN: {methods.bankTransfer.iban || 'Não configurado'}</p>
                <p className="text-xs text-gray-500 mt-1">Titular: {methods.bankTransfer.accountHolder || 'Não configurado'}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMethodModal('bankTransfer')}
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                Configurar
              </button>
            </div>
          )}
        </div>

        {/* Referência Multibanco */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">Pagamento por Referência Multibanco</p>
                  {methods.mbReference.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Ativo</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">Pagamento via Entidade e Referência (disponível em Multibancos e Homebanking)</p>
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
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-700">Entidade: {methods.mbReference.entity || 'Não configurado'}</p>
                <p className="text-xs text-gray-500 mt-1">Referência base: {methods.mbReference.reference || 'Não configurada'}</p>
              </div>
              <button type="button" onClick={() => setActiveMethodModal('mbReference')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Configurar</button>
            </div>
          )}
        </div>

        {/* MB Way */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">MB Way</p>
                  {methods.mbWay.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Ativo</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">Pagamento instantâneo via MB Way</p>
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
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-700">Telefone: {methods.mbWay.phoneNumber || 'Não configurado'}</p>
                <p className="text-xs text-gray-500 mt-1">Merchant ID: {methods.mbWay.merchantId || 'Não configurado'}</p>
              </div>
              <button type="button" onClick={() => setActiveMethodModal('mbWay')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Configurar</button>
            </div>
          )}
        </div>

        {/* Cartão de Crédito/Débito */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">Cartão de Crédito/Débito</p>
                  {methods.card.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Ativo</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">Pagamento online com cartão via gateway de pagamentos</p>
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
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-700">Gateway: {methods.card.provider || 'Não configurado'}</p>
                <p className="text-xs text-gray-500 mt-1">Merchant ID: {methods.card.merchantId || 'Não configurado'}</p>
              </div>
              <button type="button" onClick={() => setActiveMethodModal('card')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Configurar</button>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {saving ? 'A guardar...' : 'Guardar Configurações'}
          </button>
        </div>
      </div>

      <ModalPopup
        open={activeMethodModal !== null}
        onClose={() => setActiveMethodModal(null)}
        title={
          activeMethodModal === 'bankTransfer'
            ? 'Configurar Transferência Bancária'
            : activeMethodModal === 'mbReference'
              ? 'Configurar Referência Multibanco'
              : activeMethodModal === 'mbWay'
                ? 'Configurar MB Way'
                : 'Configurar Cartão'
        }
        maxWidthClass="max-w-2xl"
      >
        {activeMethodModal === 'bankTransfer' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IBAN <span className="text-red-500">*</span></label>
              <input type="text" value={methods.bankTransfer.iban} onChange={(e) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer, iban: e.target.value } })} placeholder="PT50 0000 0000 0000 0000 0000 0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titular da Conta <span className="text-red-500">*</span></label>
              <input type="text" value={methods.bankTransfer.accountHolder} onChange={(e) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer, accountHolder: e.target.value } })} placeholder="Nome do condomínio" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        {activeMethodModal === 'mbReference' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900 font-medium mb-1">Como obter Entidade e Referência?</p>
              <p className="text-xs text-blue-700">Necessita de contrato com instituição de pagamentos (ex: Easypay, SIBS, IfiPay, Eupago). Estas entidades fornecem a Entidade e geram Referências dinâmicas por pagamento.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entidade <span className="text-red-500">*</span></label>
                <input type="text" value={methods.mbReference.entity} onChange={(e) => setMethods({ ...methods, mbReference: { ...methods.mbReference, entity: e.target.value } })} placeholder="12345" maxLength={5} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-gray-500 mt-1">5 dígitos</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referência Base <span className="text-gray-400">(opcional)</span></label>
                <input type="text" value={methods.mbReference.reference} onChange={(e) => setMethods({ ...methods, mbReference: { ...methods.mbReference, reference: e.target.value } })} placeholder="999 999 999" maxLength={9} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-gray-500 mt-1">9 dígitos</p>
              </div>
            </div>
          </div>
        )}

        {activeMethodModal === 'mbWay' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900 font-medium mb-1">Requisitos MB Way</p>
              <p className="text-xs text-blue-700">Necessita de integração com gateway de pagamentos (ex: Easypay, SIBS, IfiPay). O gateway gera pedidos de pagamento MB Way e encaminha o dinheiro para o IBAN configurado.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Telefone do Condomínio <span className="text-red-500">*</span></label>
              <input type="tel" value={methods.mbWay.phoneNumber} onChange={(e) => setMethods({ ...methods, mbWay: { ...methods.mbWay, phoneNumber: e.target.value } })} placeholder="+351 912 345 678" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-500 mt-1">Telefone associado à conta MB Way mercante</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID / API Key <span className="text-red-500">*</span></label>
              <input type="text" value={methods.mbWay.merchantId} onChange={(e) => setMethods({ ...methods, mbWay: { ...methods.mbWay, merchantId: e.target.value } })} placeholder="Fornecido pelo gateway de pagamentos" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        {activeMethodModal === 'card' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900 font-medium mb-1">Requisitos Pagamento por Cartão</p>
              <p className="text-xs text-blue-700">Necessita de conta em gateway de pagamentos internacional (ex: Stripe, PayPal, Easypay). Os cartões são processados pelo gateway e o valor transferido para o IBAN do condomínio.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gateway de Pagamentos <span className="text-red-500">*</span></label>
              <select value={methods.card.provider} onChange={(e) => setMethods({ ...methods, card: { ...methods.card, provider: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="stripe">Stripe</option><option value="easypay">Easypay</option><option value="sibs">SIBS</option><option value="paypal">PayPal</option><option value="ifthenpay">IfthenPay</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Public/Publishable Key <span className="text-red-500">*</span></label>
              <input type="text" value={methods.card.publicKey} onChange={(e) => setMethods({ ...methods, card: { ...methods.card, publicKey: e.target.value } })} placeholder="pk_live_..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secret/API Key <span className="text-red-500">*</span></label>
              <input type="password" value={methods.card.secretKey} onChange={(e) => setMethods({ ...methods, card: { ...methods.card, secretKey: e.target.value } })} placeholder="sk_live_... (deixe em branco para manter o atual)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-500 mt-1">Nunca partilhe esta chave. Será guardada de forma segura.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID</label>
              <input type="text" value={methods.card.merchantId} onChange={(e) => setMethods({ ...methods, card: { ...methods.card, merchantId: e.target.value } })} placeholder="ID da conta comerciante (opcional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-3">
          <button type="button" onClick={() => setActiveMethodModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Fechar</button>
          <button type="button" onClick={saveAndCloseMethodModal} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">{saving ? 'A guardar...' : 'Guardar Configurações'}</button>
        </div>
      </ModalPopup>
    </div>
  );
}

function CommunicationChannelsContent() {
  const { condominiumId } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [activeChannelModal, setActiveChannelModal] = useState<'email' | 'whatsApp' | null>(null);
  const [settings, setSettings] = useState<CommunicationSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showWhatsAppKey, setShowWhatsAppKey] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [whatsAppApiKey, setWhatsAppApiKey] = useState('');

  const loadSettings = useCallback(async () => {
    if (!condominiumId) return;
    try {
      setLoading(true);
      const response = await communicationSettingsApi.get(condominiumId);
      setSettings(response.data);
    } catch (error) {
      console.error('Error loading communication settings:', error);
    } finally {
      setLoading(false);
    }
  }, [condominiumId]);

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
        emailFromAddress: settings.emailFromAddress,
        emailFromName: settings.emailFromName,
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
      toastSuccess('Configurações guardadas com sucesso!');
      return true;
    } catch (error) {
      console.error('Error saving communication settings:', error);
      toastError('Erro ao guardar configurações.');
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
    return <div className="text-center py-8 text-gray-500">A carregar...</div>;
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Canais de Comunicação</h3>
        <p className="text-sm text-gray-500">Configure os canais para enviar notificações, recibos e comunicados aos residentes</p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Announcements Configuration */}
        <div className="border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Comunicados</p>
              <p className="text-sm text-gray-500">Permitir comentários e respostas nos comunicados</p>
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
          <p className="text-xs text-gray-500">
            Quando desativado, os comunicados ficam apenas em modo de visualização.
          </p>
        </div>

        {/* Email Configuration */}
        <div className="border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Email (SMTP)</p>
              <p className="text-sm text-gray-500">Configure o servidor SMTP para envio de emails (Gmail, Outlook, etc.)</p>
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
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-700">SMTP: {settings.emailSmtpHost || 'Não configurado'}</p>
                <p className="text-xs text-gray-500 mt-1">Remetente: {settings.emailFromAddress || 'Não configurado'}</p>
              </div>
              <button type="button" onClick={() => setActiveChannelModal('email')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Configurar</button>
            </div>
          )}
        </div>

        {/* WhatsApp Configuration */}
        <div className="border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">WhatsApp Business</p>
              <p className="text-sm text-gray-500">Configure API para envio de mensagens WhatsApp (requer conta Business)</p>
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
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-700">Número: {settings.whatsAppPhoneNumber || 'Não configurado'}</p>
                <p className="text-xs text-gray-500 mt-1">Provedor: {settings.whatsAppApiProvider || 'Não configurado'}</p>
              </div>
              <button type="button" onClick={() => setActiveChannelModal('whatsApp')} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Configurar</button>
            </div>
          )}
        </div>

        {/* SMS Configuration (Disabled for now) */}
        <div className="border border-gray-200 rounded-lg p-5 opacity-60">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">SMS</p>
              <p className="text-sm text-gray-500">Notificações via SMS (funcionalidade em desenvolvimento)</p>
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                A guardar...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar Configurações
              </>
            )}
          </button>
        </div>
      </div>

      <ModalPopup
        open={activeChannelModal !== null}
        onClose={() => setActiveChannelModal(null)}
        title={activeChannelModal === 'email' ? 'Configurar Email (SMTP)' : 'Configurar WhatsApp Business'}
        maxWidthClass="max-w-3xl"
      >
        {activeChannelModal === 'email' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Servidor SMTP <span className="text-gray-500 font-normal ml-1">(ex: smtp.gmail.com)</span></label>
                <input type="text" value={settings.emailSmtpHost || ''} onChange={(e) => setSettings({ ...settings, emailSmtpHost: e.target.value })} placeholder="smtp.gmail.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Porta <span className="text-gray-500 font-normal ml-1">(geralmente 587)</span></label>
                <input type="number" value={settings.emailSmtpPort || 587} onChange={(e) => setSettings({ ...settings, emailSmtpPort: parseInt(e.target.value, 10) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email / Username</label>
                <input type="text" value={settings.emailUsername || ''} onChange={(e) => setSettings({ ...settings, emailUsername: e.target.value })} placeholder="condominio@gmail.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password / App Password</label>
                <div className="relative">
                  <input type={showEmailPassword ? 'text' : 'password'} value={emailPassword} placeholder="(manter existente se vazio)" onChange={(e) => setEmailPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="button" onClick={() => setShowEmailPassword(!showEmailPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs">{showEmailPassword ? 'Ocultar' : 'Mostrar'}</button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Gmail: use App Password (não a senha normal)</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Remetente</label>
                <input type="email" value={settings.emailFromAddress || ''} onChange={(e) => setSettings({ ...settings, emailFromAddress: e.target.value })} placeholder="noreply@condominio.pt" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Remetente</label>
                <input type="text" value={settings.emailFromName || ''} onChange={(e) => setSettings({ ...settings, emailFromName: e.target.value })} placeholder="Condomínio XYZ" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="emailUseSslModal" checked={settings.emailUseSsl} onChange={(e) => setSettings({ ...settings, emailUseSsl: e.target.checked })} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
              <label htmlFor="emailUseSslModal" className="text-sm text-gray-700">Usar SSL/TLS (recomendado)</label>
            </div>
          </div>
        )}

        {activeChannelModal === 'whatsApp' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número WhatsApp Business</label>
                <input type="tel" value={settings.whatsAppPhoneNumber || ''} onChange={(e) => setSettings({ ...settings, whatsAppPhoneNumber: e.target.value })} placeholder="+351 912 345 678" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provedor API</label>
                <select value={settings.whatsAppApiProvider || ''} onChange={(e) => setSettings({ ...settings, whatsAppApiProvider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Selecione...</option>
                  <option value="twilio">Twilio</option>
                  <option value="whatsapp-business-api">WhatsApp Business API</option>
                  <option value="360dialog">360dialog</option>
                  <option value="other">Outro</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key / Token</label>
              <div className="relative">
                <input type={showWhatsAppKey ? 'text' : 'password'} value={whatsAppApiKey} placeholder="(manter existente se vazio)" onChange={(e) => setWhatsAppApiKey(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="button" onClick={() => setShowWhatsAppKey(!showWhatsAppKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs">{showWhatsAppKey ? 'Ocultar' : 'Mostrar'}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID do Grupo WhatsApp <span className="text-gray-500 font-normal ml-1">(opcional)</span></label>
              <input type="text" value={settings.whatsAppGroupId || ''} onChange={(e) => setSettings({ ...settings, whatsAppGroupId: e.target.value })} placeholder="120363xxxxx@g.us" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-500 mt-1">Para enviar mensagens para um grupo específico</p>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-3">
          <button type="button" onClick={() => setActiveChannelModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Fechar</button>
          <button type="button" onClick={saveAndCloseChannelModal} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors">{saving ? 'A guardar...' : 'Guardar Configurações'}</button>
        </div>
      </ModalPopup>
    </div>
  );
}


function SystemEmailContent() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [settings, setSettings] = useState<SystemEmailSettingsDto | null>(null);
  const [form, setForm] = useState<UpdateSystemEmailSettingsRequest>({
    emailEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    username: '',
    password: '',
    fromAddress: 'no-reply@habituscond.pt',
    fromName: 'Habitus',
    useSsl: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const response = await systemEmailSettingsApi.get();
        setSettings(response.data);
        setForm({
          emailEnabled: response.data.emailEnabled,
          smtpHost: response.data.smtpHost || '',
          smtpPort: response.data.smtpPort || 587,
          username: response.data.username || '',
          password: '',
          fromAddress: response.data.fromAddress || 'no-reply@habituscond.pt',
          fromName: response.data.fromName || 'Habitus',
          useSsl: response.data.useSsl,
        });
      } catch (error) {
        console.error('Erro ao carregar configurações de email do sistema:', error);
        toastError('Erro ao carregar configurações de email do sistema.');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [toastError]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await systemEmailSettingsApi.update(form);
      setSettings(response.data);
      setForm((prev) => ({ ...prev, password: '' }));
      toastSuccess('Configurações de email do sistema guardadas com sucesso!');
    } catch (error) {
      console.error('Erro ao guardar configurações de email do sistema:', error);
      toastError('Erro ao guardar configurações de email do sistema.');
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
      toastError('Erro ao testar a ligação de email. Verifique as configurações.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />A carregar...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Email de Sistema</h3>
        <p className="text-sm text-gray-500">
          Configure o servidor de email para envio de notificações automáticas da plataforma para os condomínios (ex: novas notificações, pedidos de aprovação).
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-900 font-medium mb-1">Email de sistema vs. Email do condomínio</p>
        <p className="text-xs text-blue-700">
          Este email é enviado pelo sistema (no-reply) para os administradores dos condomínios a alertar sobre novas notificações e pedidos de aprovação.
          É diferente do email de cada condomínio, que é usado para comunicar com os residentes.
        </p>
      </div>

      <div className="space-y-4 max-w-3xl">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">Email de Sistema Ativo</p>
                  {form.emailEnabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Ativo</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">Enviar emails automáticos de sistema para os condomínios</p>
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

          <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Servidor SMTP</label>
                <input
                  type="text"
                  value={form.smtpHost || ''}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  placeholder="smtp.exemplo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
                <input
                  type="number"
                  value={form.smtpPort}
                  onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) || 587 })}
                  placeholder="587"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Utilizador</label>
              <input
                type="text"
                value={form.username || ''}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="no-reply@habituscond.pt"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Palavra-passe</label>
              <input
                type="password"
                value={form.password || ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={settings?.hasPassword ? 'Já configurada. Preencha para substituir.' : 'Palavra-passe do servidor SMTP'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email de Origem</label>
                <input
                  type="email"
                  value={form.fromAddress}
                  onChange={(e) => setForm({ ...form, fromAddress: e.target.value })}
                  placeholder="no-reply@habituscond.pt"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Origem</label>
                <input
                  type="text"
                  value={form.fromName}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                  placeholder="Habitus"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useSsl"
                checked={form.useSsl}
                onChange={(e) => setForm({ ...form, useSsl: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="useSsl" className="text-sm text-gray-700">Usar SSL/TLS (recomendado)</label>
            </div>

            {settings && (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                <p className="text-gray-500">Palavra-passe</p>
                <p className="font-medium text-gray-900">{settings.hasPassword ? 'Configurada' : 'Não configurada'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {saving ? 'A guardar...' : 'Guardar Configurações'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !form.emailEnabled}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            {testing ? 'A verificar...' : 'Verificar Configuração'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Warehouse, Truck, Home, FileText, CreditCard, Mail, Save
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { paymentSettingsApi, communicationSettingsApi } from '../api/services';
import type { CommunicationSettingsDto, UpdateCommunicationSettingsRequest } from '../types';
import SharedSpacesPage from './SharedSpacesPage';
import SuppliersPage from './SuppliersPage';
import UnitsPage from './UnitsPage';

type TabKey = 'spaces' | 'suppliers' | 'units' | 'receipts' | 'payments' | 'communication';

interface Tab {
  key: TabKey;
  label: string;
  icon: any;
}

const tabs: Tab[] = [
  { key: 'spaces', label: 'Espaços Comuns', icon: Warehouse },
  { key: 'suppliers', label: 'Fornecedores', icon: Truck },
  { key: 'units', label: 'Frações', icon: Home },
  { key: 'receipts', label: 'Template Recibos', icon: FileText },
  { key: 'payments', label: 'Métodos de Pagamento', icon: CreditCard },
  { key: 'communication', label: 'Canais de Comunicação', icon: Mail },
];

export default function CondominiumSettingsPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>('spaces');

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab') as TabKey;
    if (tab && tabs.some(t => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso apenas para administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuração do Condomínio</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gerir todas as configurações do condomínio</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {tabs.map(({ key, label, icon: Icon }) => (
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
          {activeTab === 'receipts' && <ReceiptTemplateContent />}
          {activeTab === 'payments' && <PaymentMethodsContent />}
          {activeTab === 'communication' && <CommunicationChannelsContent />}
        </div>
      </div>
    </div>
  );
}

// Wrapper components to render existing pages without layout
function SharedSpacesContent() {
  return (
    <div className="-m-6">
      <SharedSpacesPage embedded />
    </div>
  );
}

function SuppliersContent() {
  return (
    <div className="-m-6">
      <SuppliersPage embedded />
    </div>
  );
}

function UnitsContent() {
  return (
    <div className="-m-6">
      <UnitsPage embedded />
    </div>
  );
}

function ReceiptTemplateContent() {
  const [template, setTemplate] = useState({
    companyName: 'Condomínio Exemplo',
    address: 'Rua Exemplo, 123',
    taxId: '123456789',
    email: 'admin@condominio.pt',
    phone: '+351 912 345 678',
    footerText: 'Obrigado pelo seu pagamento.',
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Template de Recibos</h3>
        <p className="text-sm text-gray-500">Configure as informações que aparecem nos recibos gerados</p>
      </div>

      <form className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
            <input
              type="text"
              value={template.companyName}
              onChange={(e) => setTemplate({ ...template, companyName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NIF</label>
            <input
              type="text"
              value={template.taxId}
              onChange={(e) => setTemplate({ ...template, taxId: e.target.value })}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={template.email}
              onChange={(e) => setTemplate({ ...template, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="tel"
              value={template.phone}
              onChange={(e) => setTemplate({ ...template, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Texto de Rodapé</label>
          <textarea
            value={template.footerText}
            onChange={(e) => setTemplate({ ...template, footerText: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4 inline mr-2" />
            Guardar Template
          </button>
        </div>
      </form>
    </div>
  );
}

function PaymentMethodsContent() {
  const { condominiumId } = useAuth();
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

  useEffect(() => {
    if (condominiumId) {
      loadPaymentSettings();
    }
  }, [condominiumId]);

  const loadPaymentSettings = async () => {
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
    } catch (error: any) {
      console.error('Error loading payment settings:', error);
      alert(error.response?.data?.message || 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!condominiumId) return;
    
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
      alert('Configurações guardadas com sucesso!');
      
      // Reload to get updated values without secret key
      await loadPaymentSettings();
    } catch (error: any) {
      console.error('Error saving payment settings:', error);
      alert(error.response?.data?.message || 'Erro ao guardar configurações');
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
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    bankTransfer: { ...methods.bankTransfer, enabled: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
          
          {methods.bankTransfer.enabled && (
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IBAN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={methods.bankTransfer.iban}
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    bankTransfer: { ...methods.bankTransfer, iban: e.target.value }
                  })}
                  placeholder="PT50 0000 0000 0000 0000 0000 0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titular da Conta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={methods.bankTransfer.accountHolder}
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    bankTransfer: { ...methods.bankTransfer, accountHolder: e.target.value }
                  })}
                  placeholder="Nome do condomínio"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
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
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    mbReference: { ...methods.mbReference, enabled: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
          
          {methods.mbReference.enabled && (
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-blue-900 font-medium mb-1">💡 Como obter Entidade e Referência?</p>
                <p className="text-xs text-blue-700">
                  Necessita de contrato com instituição de pagamentos (ex: Easypay, SIBS, IfiPay, Eupago).
                  Estas entidades fornecem a Entidade e geram Referências dinâmicas por pagamento.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entidade <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={methods.mbReference.entity}
                    onChange={(e) => setMethods({ 
                      ...methods, 
                      mbReference: { ...methods.mbReference, entity: e.target.value }
                    })}
                    placeholder="12345"
                    maxLength={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">5 dígitos</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referência Base <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={methods.mbReference.reference}
                    onChange={(e) => setMethods({ 
                      ...methods, 
                      mbReference: { ...methods.mbReference, reference: e.target.value }
                    })}
                    placeholder="999 999 999"
                    maxLength={9}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">9 dígitos</p>
                </div>
              </div>
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
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    mbWay: { ...methods.mbWay, enabled: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
          
          {methods.mbWay.enabled && (
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-blue-900 font-medium mb-1">💡 Requisitos MB Way</p>
                <p className="text-xs text-blue-700">
                  Necessita de integração com gateway de pagamentos (ex: Easypay, SIBS, IfiPay).
                  O gateway gera pedidos de pagamento MB Way e encaminha o dinheiro para o IBAN configurado.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Telefone do Condomínio <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={methods.mbWay.phoneNumber}
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    mbWay: { ...methods.mbWay, phoneNumber: e.target.value }
                  })}
                  placeholder="+351 912 345 678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Telefone associado à conta MB Way mercante</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Merchant ID / API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={methods.mbWay.merchantId}
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    mbWay: { ...methods.mbWay, merchantId: e.target.value }
                  })}
                  placeholder="Fornecido pelo gateway de pagamentos"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
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
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    card: { ...methods.card, enabled: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
          
          {methods.card.enabled && (
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-blue-900 font-medium mb-1">💡 Requisitos Pagamento por Cartão</p>
                <p className="text-xs text-blue-700">
                  Necessita de conta em gateway de pagamentos internacional (ex: Stripe, PayPal, Easypay).
                  Os cartões são processados pelo gateway e o valor transferido para o IBAN do condomínio.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gateway de Pagamentos <span className="text-red-500">*</span>
                </label>
                <select
                  value={methods.card.provider}
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    card: { ...methods.card, provider: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="stripe">Stripe</option>
                  <option value="easypay">Easypay</option>
                  <option value="sibs">SIBS</option>
                  <option value="paypal">PayPal</option>
                  <option value="ifthenpay">IfthenPay</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Public/Publishable Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={methods.card.publicKey}
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    card: { ...methods.card, publicKey: e.target.value }
                  })}
                  placeholder="pk_live_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secret/API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={methods.card.secretKey}
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    card: { ...methods.card, secretKey: e.target.value }
                  })}
                  placeholder="sk_live_... (deixe em branco para manter o atual)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">⚠️ Nunca partilhe esta chave. Será guardada de forma segura.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Merchant ID
                </label>
                <input
                  type="text"
                  value={methods.card.merchantId}
                  onChange={(e) => setMethods({ 
                    ...methods, 
                    card: { ...methods.card, merchantId: e.target.value }
                  })}
                  placeholder="ID da conta comerciante (opcional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
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
    </div>
  );
}

function CommunicationChannelsContent() {
  const { condominiumId } = useAuth();
  const [settings, setSettings] = useState<CommunicationSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showWhatsAppKey, setShowWhatsAppKey] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [whatsAppApiKey, setWhatsAppApiKey] = useState('');

  useEffect(() => {
    if (condominiumId) {
      loadSettings();
    }
  }, [condominiumId]);

  const loadSettings = async () => {
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
  };

  const handleSave = async () => {
    if (!condominiumId || !settings) return;
    
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
      };
      
      await communicationSettingsApi.update(condominiumId, request);
      alert('Configurações guardadas com sucesso!');
    } catch (error) {
      console.error('Error saving communication settings:', error);
      alert('Erro ao guardar configurações');
    } finally {
      setSaving(false);
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
                onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {settings.emailEnabled && (
            <div className="space-y-4 pt-3 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servidor SMTP
                    <span className="text-gray-500 font-normal ml-1">(ex: smtp.gmail.com)</span>
                  </label>
                  <input
                    type="text"
                    value={settings.emailSmtpHost || ''}
                    onChange={(e) => setSettings({ ...settings, emailSmtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Porta
                    <span className="text-gray-500 font-normal ml-1">(geralmente 587)</span>
                  </label>
                  <input
                    type="number"
                    value={settings.emailSmtpPort || 587}
                    onChange={(e) => setSettings({ ...settings, emailSmtpPort: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email / Username</label>
                  <input
                    type="text"
                    value={settings.emailUsername || ''}
                    onChange={(e) => setSettings({ ...settings, emailUsername: e.target.value })}
                    placeholder="condominio@gmail.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password / App Password
                  </label>
                  <div className="relative">
                    <input
                      type={showEmailPassword ? 'text' : 'password'}
                      value={emailPassword}
                      placeholder="(manter existente se vazio)"
                      onChange={(e) => setEmailPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmailPassword(!showEmailPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs"
                    >
                      {showEmailPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Gmail: use App Password (não a senha normal)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Remetente</label>
                  <input
                    type="email"
                    value={settings.emailFromAddress || ''}
                    onChange={(e) => setSettings({ ...settings, emailFromAddress: e.target.value })}
                    placeholder="noreply@condominio.pt"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Remetente</label>
                  <input
                    type="text"
                    value={settings.emailFromName || ''}
                    onChange={(e) => setSettings({ ...settings, emailFromName: e.target.value })}
                    placeholder="Condomínio XYZ"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emailUseSsl"
                  checked={settings.emailUseSsl}
                  onChange={(e) => setSettings({ ...settings, emailUseSsl: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="emailUseSsl" className="text-sm text-gray-700">
                  Usar SSL/TLS (recomendado)
                </label>
              </div>
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
                onChange={(e) => setSettings({ ...settings, whatsAppEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {settings.whatsAppEnabled && (
            <div className="space-y-4 pt-3 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número WhatsApp Business</label>
                  <input
                    type="tel"
                    value={settings.whatsAppPhoneNumber || ''}
                    onChange={(e) => setSettings({ ...settings, whatsAppPhoneNumber: e.target.value })}
                    placeholder="+351 912 345 678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provedor API</label>
                  <select
                    value={settings.whatsAppApiProvider || ''}
                    onChange={(e) => setSettings({ ...settings, whatsAppApiProvider: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
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
                  <input
                    type={showWhatsAppKey ? 'text' : 'password'}
                    value={whatsAppApiKey}
                    placeholder="(manter existente se vazio)"
                    onChange={(e) => setWhatsAppApiKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppKey(!showWhatsAppKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs"
                  >
                    {showWhatsAppKey ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID do Grupo WhatsApp
                  <span className="text-gray-500 font-normal ml-1">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={settings.whatsAppGroupId || ''}
                  onChange={(e) => setSettings({ ...settings, whatsAppGroupId: e.target.value })}
                  placeholder="120363xxxxx@g.us"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Para enviar mensagens para um grupo específico
                </p>
              </div>
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
    </div>
  );
}


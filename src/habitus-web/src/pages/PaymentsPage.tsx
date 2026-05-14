import { useEffect, useState, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, Clock, AlertCircle, Upload, FileText, Download, RefreshCw, CreditCard } from 'lucide-react';
import { paymentsApi, paymentMethodsApi, documentsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import type { PaymentDto, CreatePaymentRequest, PaymentMethodsDto } from '../types';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const responseData = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
    if (responseData?.message) {
      return responseData.message;
    }

    if (responseData?.errors) {
      const errorMessages = Object.values(responseData.errors).flat();
      if (errorMessages.length > 0) {
        return `Erro de validação:\n${errorMessages.join('\n')}`;
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export default function PaymentsPage() {
  const { condominiumId, unitId } = useAuth();
  const { success, error: toastError } = useToast();
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDto | null>(null);
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreatePaymentRequest>({
    type: 'MonthlyFee',
    method: 'BankTransfer',
    amount: 0,
    description: '',
  });
  const [quotaPeriodicity, setQuotaPeriodicity] = useState<'Monthly' | 'Quarterly' | 'Annual'>('Monthly');
  const [trimestralStart, setTrimestralStart] = useState<number>(1);

  const PT_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const currentMonth = new Date().getMonth(); // 0-indexed
  const currentYear = new Date().getFullYear();

  const loadPayments = async () => {
    try {
      console.log('Loading payments...');
      const response = await paymentsApi.getMyPayments();
      console.log('Payments loaded:', response.data);
      setPayments(response.data);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = useCallback(async () => {
    if (!condominiumId) return;
    try {
      const response = await paymentMethodsApi.get(condominiumId);
      setPaymentMethods(response.data);
      
      // Set default payment method to the first available one
      if (response.data.bankTransferEnabled) {
        setForm(prev => ({ ...prev, method: 'BankTransfer' }));
      } else if (response.data.mbWayEnabled) {
        setForm(prev => ({ ...prev, method: 'MBWay' }));
      } else if (response.data.cardEnabled) {
        setForm(prev => ({ ...prev, method: 'Card' }));
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  }, [condominiumId]);

  useEffect(() => {
    loadPayments();
    if (condominiumId) {
      loadPaymentMethods();
    }
  }, [condominiumId, loadPaymentMethods]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate amount
    if (!form.amount || form.amount <= 0) {
      toastError('Por favor, insira um valor válido maior que zero.');
      return;
    }

    // Validate description
    if (!form.description || form.description.trim() === '') {
      toastError('Por favor, insira uma descrição.');
      return;
    }

    // Proof is required only for Bank Transfer
    const requiresProof = form.method === 'BankTransfer';
    if (requiresProof && !proofFile) {
      toastError('Por favor, anexe o comprovativo de pagamento para transferências bancárias.');
      return;
    }

    setSubmitting(true);
    try {
      console.log('Creating payment with data:', form);
      
      // 1. Create the payment first
      // Build quota period payload when type is MonthlyFee
      let periodPayload: Partial<CreatePaymentRequest> = {};
      if (form.type === 'MonthlyFee') {
        if (quotaPeriodicity === 'Monthly') {
          periodPayload = { quotaPeriodicity: 'Monthly', quotaMonthStart: currentMonth + 1, quotaMonthEnd: currentMonth + 1, quotaYear: currentYear };
        } else if (quotaPeriodicity === 'Quarterly') {
          periodPayload = { quotaPeriodicity: 'Quarterly', quotaMonthStart: trimestralStart, quotaMonthEnd: trimestralStart + 3, quotaYear: currentYear };
        } else {
          periodPayload = { quotaPeriodicity: 'Annual', quotaMonthStart: 1, quotaMonthEnd: 12, quotaYear: currentYear };
        }
      }
      const paymentResponse = await paymentsApi.create({ ...form, ...periodPayload });
      const paymentId = paymentResponse.data.id;

      // 2. Upload proof if provided (required for BankTransfer)
      if (proofFile) {
        if (!unitId) {
          throw new Error('UnitId não disponível. Por favor, faça login novamente.');
        }
        
        console.log('Uploading proof document...');
        const formData = new FormData();
        formData.append('file', proofFile);
        formData.append('name', `Comprovativo - ${form.description}`);
        formData.append('type', 'UnitOther');  // Changed to Unit context type
        formData.append('context', 'Unit');    // Changed to Unit context (Resident has permission)
        formData.append('unitId', unitId);     // Required for Unit context
        formData.append('description', `Comprovativo de pagamento - ${form.description}`);
        
        try {
          const uploadResponse = await documentsApi.upload(formData);
          console.log('Upload response:', uploadResponse.data);
          // Store the document ID instead of filePath
          const proofUrl = uploadResponse.data.id;
          await paymentsApi.uploadProof(paymentId, proofUrl);
        } catch (uploadError: unknown) {
          if (typeof uploadError === 'object' && uploadError !== null && 'response' in uploadError) {
            console.error('Upload error details:', (uploadError as { response?: { data?: unknown } }).response?.data);
          }
          throw uploadError;
        }
      }

      // Reset form and close modal
      setShowCreateModal(false);
      setForm({ type: 'MonthlyFee', method: 'BankTransfer', amount: 0, description: '' });
      setQuotaPeriodicity('Monthly');
      setTrimestralStart(1);
      setProofFile(null);
      
      // Reload payments after a short delay to ensure backend has processed
      setTimeout(() => {
        loadPayments();
      }, 500);
      
      success('Pagamento criado com sucesso! Aguarde aprovação do administrador.');
    } catch (error: unknown) {
      console.error('Error creating payment:', error);
      toastError(getApiErrorMessage(error, 'Erro ao criar pagamento. Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (paymentId: string) => {
    try {
      await paymentsApi.cancel(paymentId);
      loadPayments();
      setSelectedPayment(null);
      setCancelPaymentId(null);
      success('Pagamento cancelado com sucesso.');
    } catch (error) {
      console.error('Error cancelling payment:', error);
      toastError('Erro ao cancelar pagamento. Tente novamente.');
      setCancelPaymentId(null);
    }
  };

  const handleDownloadProof = async (documentIdOrPath: string, description: string) => {
    try {
      const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (guidRegex.test(documentIdOrPath)) {
        await documentsApi.download(documentIdOrPath, `Comprovativo - ${description}.pdf`);
      } else if (documentIdOrPath.startsWith('/uploads/')) {
        toastError('Este comprovativo usa formato antigo. Contacte o administrador.');
      } else {
        toastError('Formato de comprovativo não reconhecido.');
      }
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toastError('Erro ao descarregar o comprovativo. Tente novamente.');
    }
  };

  const handleDownloadReceipt = async (payment: PaymentDto) => {
    if (!payment.receiptNumber || !payment.receiptYear) {
      toastError('Este pagamento ainda não tem recibo emitido.');
      return;
    }
    try {
      await paymentsApi.downloadReceipt(payment.id, payment.receiptNumber, payment.receiptYear);
    } catch (error: unknown) {
      console.error('Error downloading receipt:', error);
      toastError(getApiErrorMessage(error, 'Erro ao descarregar o recibo.'));
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      Pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Pendente' },
      Approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Aprovado' },
      Rejected: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Rejeitado' },
      Cancelled: { icon: XCircle, color: 'bg-gray-100 text-gray-800', label: 'Cancelado' },
    };
    const badge = badges[status as keyof typeof badges] || badges.Pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getTypeName = (type: string) => {
    const types: Record<string, string> = {
      MonthlyFee: 'Quotas',
      ExtraordinaryFee: 'Quota Extraordinária',
      Reservation: 'Reservas',
      Other: 'Outros',
    };
    return types[type] || type;
  };

  const getMethodName = (method: string) => {
    const methods: Record<string, string> = {
      BankTransfer: 'Transferência Bancária',
      MBWay: 'MB Way',
      Card: 'Cartão',
    };
    return methods[method] || method;
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3 text-gray-400">
        <RefreshCw className="w-8 h-8 animate-spin" aria-hidden="true" />
        <p className="text-sm">A carregar pagamentos...</p>
      </div>
    );
  }

  console.log('Rendering payments list. Total payments:', payments.length);

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={cancelPaymentId !== null}
        title="Cancelar pagamento"
        message="Tem a certeza que deseja cancelar este pagamento? Esta ação não pode ser revertida."
        confirmLabel="Cancelar pagamento"
        variant="danger"
        onConfirm={() => cancelPaymentId && handleCancel(cancelPaymentId)}
        onCancel={() => setCancelPaymentId(null)}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
          <p className="text-gray-600">Gerencie os seus pagamentos ao condomínio</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Pagamento
        </button>
      </div>

      {/* Payments List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Histórico de Pagamentos</h2>
          <button
            type="button"
            onClick={() => loadPayments()}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Atualizar
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-gray-400">
              <CreditCard className="w-10 h-10 opacity-40" aria-hidden="true" />
              <p className="text-sm font-medium">Nenhum pagamento registado</p>
              <p className="text-xs text-gray-400">Clique em "Novo Pagamento" para submeter o seu primeiro pagamento.</p>
            </div>
          ) : (
            payments.map((payment) => (
              <div
                key={payment.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedPayment(payment)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{getTypeName(payment.type)}</h3>
                      {getStatusBadge(payment.status)}
                    </div>
                    <p className="text-sm text-gray-600">{payment.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-xs text-gray-500">
                        Criado: {new Date(payment.createdDate).toLocaleDateString('pt-PT')}
                      </p>
                      {/* Document Indicators */}
                      <div className="flex items-center gap-2">
                        {payment.proofOfPaymentUrl && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded" title="Comprovativo disponível">
                            <Download className="w-3 h-3" />
                            Comprovativo
                          </span>
                        )}
                        {payment.status === 'Approved' && payment.hasReceipt && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded" title="Recibo disponível">
                            <FileText className="w-3 h-3" />
                            Recibo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">€{payment.amount.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Payment Modal */}
      <ModalPopup
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setProofFile(null); }}
        title="Novo Pagamento"
        maxWidthClass="max-w-lg"
      >
        <div className="p-6">
          <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Pagamento
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as CreatePaymentRequest['type'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="MonthlyFee">Quotas</option>
                  <option value="Reservation">Reservas</option>
                  <option value="Other">Outros</option>
                </select>
              </div>

              {/* Quota Periodicity Selector */}
              {form.type === 'MonthlyFee' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Periodicidade
                  </label>
                  <div className="flex gap-2">
                    {(['Monthly', 'Quarterly', 'Annual'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setQuotaPeriodicity(p)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          quotaPeriodicity === p
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {p === 'Monthly' ? 'Mensal' : p === 'Quarterly' ? 'Trimestral' : 'Anual'}
                      </button>
                    ))}
                  </div>
                  {quotaPeriodicity === 'Monthly' && (
                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 px-3 py-2 rounded">
                      Período: <strong>{PT_MONTHS[currentMonth]}</strong> {currentYear}
                    </p>
                  )}
                  {quotaPeriodicity === 'Quarterly' && (
                    <div className="mt-2">
                      <select
                        value={trimestralStart}
                        onChange={(e) => setTrimestralStart(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value={1}>Janeiro – Abril</option>
                        <option value={5}>Maio – Agosto</option>
                        <option value={9}>Setembro – Dezembro</option>
                      </select>
                    </div>
                  )}
                  {quotaPeriodicity === 'Annual' && (
                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 px-3 py-2 rounded">
                      Período: <strong>Janeiro a Dezembro</strong> {currentYear}
                    </p>
                  )}
                </div>
              )}
              
              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pagamento
                </label>
                <select
                  value={form.method}
                  onChange={(e) => {
                    setForm({ ...form, method: e.target.value as CreatePaymentRequest['method'] });
                    // Clear proof file if switching away from BankTransfer
                    if (e.target.value !== 'BankTransfer') {
                      setProofFile(null);
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  {paymentMethods?.bankTransferEnabled && (
                    <option value="BankTransfer">Transferência Bancária / NIB</option>
                  )}
                  {paymentMethods?.mbWayEnabled && (
                    <option value="MBWay">MB Way</option>
                  )}
                  {paymentMethods?.cardEnabled && (
                    <option value="Card">Cartão Visa/Maestro</option>
                  )}
                  {!paymentMethods?.bankTransferEnabled && !paymentMethods?.mbWayEnabled && !paymentMethods?.cardEnabled && (
                    <option value="" disabled>Nenhum método disponível</option>
                  )}
                </select>
                {form.method !== 'BankTransfer' && form.method && (
                  <p className="text-xs text-blue-600 mt-1">
                    ✓ Pagamento automático - não requer comprovativo
                  </p>
                )}
                {(!paymentMethods?.bankTransferEnabled && !paymentMethods?.mbWayEnabled && !paymentMethods?.cardEnabled) && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Nenhum método de pagamento está disponível. Contacte a administração.
                  </p>
                )}
              </div>

              {/* Conditional Payment Method Details */}
              {form.method === 'BankTransfer' && paymentMethods?.bankTransferIban && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">Dados para Transferência:</p>
                  {paymentMethods.bankTransferAccountHolder && (
                    <p className="text-sm text-blue-800">
                      <strong>Titular:</strong> {paymentMethods.bankTransferAccountHolder}
                    </p>
                  )}
                  <p className="text-sm text-blue-800">
                    <strong>IBAN:</strong> {paymentMethods.bankTransferIban}
                  </p>
                </div>
              )}
              
              {form.method === 'MBWay' && paymentMethods?.mbWayPhoneNumber && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">Dados para MB Way:</p>
                  <p className="text-sm text-blue-800">
                    <strong>Número:</strong> {paymentMethods.mbWayPhoneNumber}
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setForm({ ...form, amount: isNaN(value) ? 0 : value });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                  placeholder="Ex: 50.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  required
                  placeholder="Ex: Pagamento quota Janeiro 2026"
                />
              </div>
              
              {/* Proof of Payment Upload - Only for Bank Transfer */}
              {form.method === 'BankTransfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comprovativo de Pagamento <span className="text-red-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors">
                    <input
                      type="file"
                      id="proof-upload"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProofFile(file);
                        }
                      }}
                      className="hidden"
                      required={form.method === 'BankTransfer'}
                    />
                    <label
                      htmlFor="proof-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="w-8 h-8 text-gray-400" />
                      {proofFile ? (
                        <div className="text-sm">
                          <p className="text-green-600 font-medium">{proofFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          <p className="font-medium">Clique para selecionar</p>
                          <p className="text-xs text-gray-500">PDF ou Imagem (máx. 10MB)</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                <strong>Importante:</strong> {form.method === 'BankTransfer' 
                  ? 'Efetue a transferência bancária e anexe o comprovativo antes de criar o pagamento.' 
                  : 'Para MB Way e Cartão, o processo de pagamento será automático após a criação do registo.'}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setProofFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors"
                  disabled={submitting || (form.method === 'BankTransfer' && !proofFile)}
                >
                  {submitting ? 'A criar...' : 'Criar Pagamento'}
                </button>
              </div>
            </form>
        </div>
      </ModalPopup>

      {/* Payment Details Modal */}
      <ModalPopup
        open={selectedPayment !== null}
        onClose={() => setSelectedPayment(null)}
        title="Detalhes do Pagamento"
        maxWidthClass="max-w-lg"
      >
        {selectedPayment && (
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Estado:</span>
              {getStatusBadge(selectedPayment.status)}
              </div>
              <div className="flex justify-between">
              <span className="text-gray-600">Tipo:</span>
              <span className="font-medium">{getTypeName(selectedPayment.type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Método:</span>
              <span className="font-medium">{getMethodName(selectedPayment.method)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Valor:</span>
              <span className="font-bold text-lg">€{selectedPayment.amount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600 block mb-1">Descrição:</span>
              <p className="text-sm">{selectedPayment.description}</p>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Data de Criação:</span>
              <span>{new Date(selectedPayment.createdDate).toLocaleString('pt-PT')}</span>
            </div>
            {selectedPayment.processedDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Data de Processamento:</span>
                <span>{new Date(selectedPayment.processedDate).toLocaleString('pt-PT')}</span>
              </div>
            )}
            {selectedPayment.processedByUserName && (
              <div className="flex justify-between">
                <span className="text-gray-600">Processado por:</span>
                <span>{selectedPayment.processedByUserName}</span>
              </div>
            )}
            {selectedPayment.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <span className="text-red-900 font-semibold block mb-1">Motivo da Rejeição:</span>
                <p className="text-sm text-red-800">{selectedPayment.rejectionReason}</p>
              </div>
            )}
            
            {/* Receipt Information */}
            {selectedPayment.status === 'Approved' && selectedPayment.hasReceipt && (
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <span className="text-green-900 font-semibold block mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Recibo Emitido
                </span>
                <p className="text-sm text-green-800">
                  Recibo Nº {selectedPayment.receiptNumber}/{selectedPayment.receiptYear}
                </p>
                {selectedPayment.receiptIssuedDate && (
                  <p className="text-xs text-green-700 mt-1">
                    Emitido em: {new Date(selectedPayment.receiptIssuedDate).toLocaleDateString('pt-PT')}
                  </p>
                )}
                {selectedPayment.receiptIssuedByUserName && (
                  <p className="text-xs text-green-700">
                    Por: {selectedPayment.receiptIssuedByUserName}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Document Actions */}
          {(selectedPayment.proofOfPaymentUrl || (selectedPayment.status === 'Approved' && selectedPayment.hasReceipt)) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Documentos</h3>
              <div className="flex flex-col gap-2">
                {selectedPayment.proofOfPaymentUrl && (
                  <button
                    onClick={() => handleDownloadProof(selectedPayment.proofOfPaymentUrl!, selectedPayment.description)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Descarregar Comprovativo de Pagamento
                  </button>
                )}
                {selectedPayment.status === 'Approved' && selectedPayment.hasReceipt && (
                  <button
                    onClick={() => handleDownloadReceipt(selectedPayment)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Descarregar Recibo
                  </button>
                )}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 mt-4">
            {selectedPayment.status === 'Pending' && (
              <button
                type="button"
                onClick={() => { setCancelPaymentId(selectedPayment.id); setSelectedPayment(null); }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancelar Pagamento
              </button>
            )}
            <button
              onClick={() => setSelectedPayment(null)}
              className={`${selectedPayment.status === 'Pending' ? 'flex-1' : 'w-full'} px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300`}
            >
              Fechar
            </button>
          </div>
        </div>
        )}
      </ModalPopup>
    </div>
  );
}

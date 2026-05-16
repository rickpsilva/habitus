import { useCallback, useEffect, useState } from 'react';
import { Activity, Play, RefreshCw, ShieldAlert } from 'lucide-react';
import { rgpdMigrationApi } from '../api/services';
import { useToast } from '../contexts/ToastContext';
import type { RgpdMigrationStatusDto } from '../types';

export default function RgpdMigrationPanel() {
  const { success, error: toastError } = useToast();
  const [status, setStatus] = useState<RgpdMigrationStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'run' | 'audit' | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await rgpdMigrationApi.getStatus();
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to load RGPD migration status:', error);
      toastError('Não foi possível carregar o estado da migração RGPD.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const runBackfill = async () => {
    setActionLoading('run');
    try {
      await rgpdMigrationApi.runMigration();
      success('Migração RGPD executada com sucesso.');
      await loadStatus();
    } catch (error) {
      console.error('Failed to run RGPD migration:', error);
      toastError('Erro ao executar migração RGPD. Verifique se já existe execução em curso.');
    } finally {
      setActionLoading(null);
    }
  };

  const runAudit = async () => {
    setActionLoading('audit');
    try {
      await rgpdMigrationApi.runAudit();
      success('Auditoria RGPD concluída.');
      await loadStatus();
    } catch (error) {
      console.error('Failed to run RGPD audit:', error);
      toastError('Erro ao executar auditoria RGPD.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">A carregar estado da migração RGPD...</div>;
  }

  if (!status) {
    return (
      <div className="bg-white border border-red-100 rounded-xl p-5 text-red-700 text-sm">
        Não foi possível obter o estado da migração RGPD.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Migração RGPD</h2>
          <p className="text-sm text-gray-500 mt-0.5">Execução manual e auditoria para migração de plaintext para encriptado em produção.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadStatus}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
          <button
            type="button"
            onClick={runAudit}
            disabled={actionLoading !== null || status.isRunning}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-50"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {actionLoading === 'audit' ? 'A auditar...' : 'Executar Auditoria'}
          </button>
          <button
            type="button"
            onClick={runBackfill}
            disabled={actionLoading !== null || status.isRunning}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {actionLoading === 'run' ? 'A executar...' : 'Executar Migração'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Execução em curso</p>
          <p className={`mt-2 text-sm font-semibold ${status.isRunning ? 'text-amber-700' : 'text-green-700'}`}>
            {status.isRunning ? 'Sim' : 'Não'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Fallback plaintext</p>
          <p className={`mt-2 text-sm font-semibold ${status.allowLegacyPlaintextFallback ? 'text-amber-700' : 'text-green-700'}`}>
            {status.allowLegacyPlaintextFallback ? 'Ativado' : 'Desativado'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Plaintext remanescente</p>
          <p className={`mt-2 text-sm font-semibold ${status.currentAuditRemainingTotalLegacyCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {status.currentAuditRemainingTotalLegacyCount}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Detalhe da auditoria atual</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
          <div className="bg-gray-50 rounded-lg p-2">Condo TaxId: <strong>{status.currentAuditCondominiumTaxIdLegacyCount}</strong></div>
          <div className="bg-gray-50 rounded-lg p-2">Condo IBAN: <strong>{status.currentAuditCondominiumPaymentIbanLegacyCount}</strong></div>
          <div className="bg-gray-50 rounded-lg p-2">Condo Address: <strong>{status.currentAuditCondominiumAddressLegacyCount}</strong></div>
          <div className="bg-gray-50 rounded-lg p-2">Invoice TaxId: <strong>{status.currentAuditInvoiceCustomerTaxIdLegacyCount}</strong></div>
          <div className="bg-gray-50 rounded-lg p-2">Invoice Address: <strong>{status.currentAuditInvoiceCustomerAddressLegacyCount}</strong></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Última execução
        </h3>
        {!status.latestRun ? (
          <p className="text-sm text-gray-500">Ainda não existem execuções registadas.</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-700">
            <p>Operação: <strong>{status.latestRun.operationType}</strong></p>
            <p>Estado: <strong>{status.latestRun.status}</strong></p>
            <p>Início: <strong>{new Date(status.latestRun.startedAt).toLocaleString('pt-PT')}</strong></p>
            <p>Fim: <strong>{status.latestRun.completedAt ? new Date(status.latestRun.completedAt).toLocaleString('pt-PT') : '-'}</strong></p>
            <p>Registos atualizados (Condo/Invoice): <strong>{status.latestRun.condominiumRecordsUpdated} / {status.latestRun.invoiceRecordsUpdated}</strong></p>
            <p>Valores encriptados: <strong>{status.latestRun.valuesEncrypted}</strong></p>
            <p>Valores legacy limpos: <strong>{status.latestRun.legacyValuesCleared}</strong></p>
            {status.latestRun.errorMessage && (
              <p className="text-red-700">Erro: <strong>{status.latestRun.errorMessage}</strong></p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

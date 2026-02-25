import { useEffect, useState } from 'react';
import { FileText, Download, Trash2 } from 'lucide-react';
import { documentsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { DocumentDto } from '../types';

const typeLabels: Record<string, string> = {
  Regulation: 'Regulamento',
  Minutes: 'Ata',
  Financial: 'Financeiro',
  Insurance: 'Seguro',
  Contract: 'Contrato',
  Other: 'Outro',
};

const typeColors: Record<string, string> = {
  Regulation: 'bg-blue-100 text-blue-700',
  Minutes: 'bg-purple-100 text-purple-700',
  Financial: 'bg-green-100 text-green-700',
  Insurance: 'bg-orange-100 text-orange-700',
  Contract: 'bg-yellow-100 text-yellow-700',
  Other: 'bg-gray-100 text-gray-600',
};

export default function DocumentsPage() {
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    documentsApi.getAll().then((r) => setDocuments(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este documento?')) return;
    await documentsApi.delete(id);
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
        <p className="text-gray-500 text-sm mt-0.5">Documentos e arquivos do condomínio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">A carregar...</div>
        ) : documents.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem documentos
          </div>
        ) : (
          documents.map((d) => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{d.name}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {typeLabels[d.type] ?? d.type}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(d.uploadedAt).toLocaleDateString('pt-PT')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {d.url && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Descarregar
                  </a>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

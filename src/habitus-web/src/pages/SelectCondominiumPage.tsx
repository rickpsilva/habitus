import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ChevronRight, Search } from 'lucide-react';
import { condominiumsApi } from '../api/services';
import type { CondominiumPublicDto } from '../types';

export default function SelectCondominiumPage() {
  const [condominiums, setCondominiums] = useState<CondominiumPublicDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    condominiumsApi.getPublic()
      .then((r) => setCondominiums(r.data))
      .catch(() => setError('Não foi possível carregar a lista de condomínios.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = condominiums.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Habitus</h1>
          <p className="text-gray-500 mt-1">Gestão de Condomínio</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Criar Conta</h2>
          <p className="text-sm text-gray-500 mb-6">
            Selecione o seu condomínio para continuar o registo.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
          )}

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar condomínio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>

          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">A carregar…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              Nenhum condomínio encontrado.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto rounded-lg border border-gray-200">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => navigate(`/user/register/${c.id}/resident`)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.address}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Iniciar sessão
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

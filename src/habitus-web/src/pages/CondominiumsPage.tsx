import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Trash2, Edit2, MapPin, CheckCircle, XCircle, UserPlus, Copy, Mail } from 'lucide-react';
import { condominiumsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { CondominiumDto, CreateCondominiumRequest, UpdateCondominiumRequest, PaginatedResponse } from '../types';

export default function CondominiumsPage() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  
  // Guard: Only Manager can access
  useEffect(() => {
    if (!isManager) {
      navigate('/dashboard');
    }
  }, [isManager, navigate]);
  
  const [condominiums, setCondominiums] = useState<CondominiumDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<CondominiumDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLinkCondoId, setVisibleLinkCondoId] = useState<string | null>(null);
  const [copiedLinkCondoId, setCopiedLinkCondoId] = useState<string | null>(null);
  const pageSize = 10;
  const [formData, setFormData] = useState<CreateCondominiumRequest>({
    name: '',
    address: '',
    taxId: '',
  });
  const [isActive, setIsActive] = useState(true);

  const load = async (page: number = 1, search: string = searchQuery) => {
    setLoading(true);
    try {
      const response = await condominiumsApi.getPaged(page, pageSize, search);
      setPagination(response.data);
      setCondominiums(response.data.items);
      setCurrentPage(page);
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        load(1, searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const updateRequest: UpdateCondominiumRequest = {
          id: editingId,
          name: formData.name,
          address: formData.address,
          taxId: formData.taxId,
          isActive: isActive,
        };
        await condominiumsApi.update(editingId, updateRequest);
      } else {
        await condominiumsApi.create(formData);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', address: '', taxId: '' });
      setIsActive(true);
      load();
    } catch (error) {
      console.error('Erro ao salvar condomínio:', error);
      alert('Erro ao salvar condomínio');
    }
  };

  const handleEdit = (condo: CondominiumDto) => {
    setEditingId(condo.id);
    setFormData({
      name: condo.name,
      address: condo.address,
      taxId: condo.taxId,
    });
    setIsActive(condo.isActive);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este condomínio?')) return;
    try {
      await condominiumsApi.delete(id);
      load();
    } catch (error) {
      console.error('Erro ao remover condomínio:', error);
      alert('Erro ao remover condomínio. Verifique se não há unidades ou utilizadores associados.');
    }
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({ name: '', address: '', taxId: '' });
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
      alert('Não foi possível copiar automaticamente. Copie o link manualmente.');
    }
  };

  if (!isManager) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>Acesso restrito a gestores</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Condomínios</h1>
          <p className="text-gray-500 text-sm mt-0.5">{condominiums.length} condomínios registados</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-80">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar condomínios..."
            />
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Novo Condomínio
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">A carregar...</div>
        ) : condominiums.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum condomínio cadastrado</p>
          </div>
        ) : (
          condominiums.map((condo) => (
            <div key={condo.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{condo.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs">
                    {condo.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3 h-3" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        <XCircle className="w-3 h-3" />
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setVisibleLinkCondoId((current) => (current === condo.id ? null : condo.id))}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                    title="Gerar link de registo de administrador"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(condo)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(condo.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{condo.address}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">NIF: {condo.taxId}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{condo.email || 'Sem email configurado'}</span>
                </div>
                {visibleLinkCondoId === condo.id && (
                  <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/70 p-2.5">
                    <p className="text-xs font-medium text-emerald-800 mb-1">Link de registo para Admin</p>
                    <a
                      href={getAdminRegisterPath(condo.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs text-emerald-700 underline break-all"
                    >
                      {getAdminRegisterUrl(condo.id)}
                    </a>
                    <button
                      onClick={() => handleCopyAdminRegisterUrl(condo.id)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedLinkCondoId === condo.id ? 'Copiado' : 'Copiar link'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
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
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? 'Editar Condomínio' : 'Novo Condomínio'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIF *</label>
                <input
                  type="text"
                  required
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email do Condomínio</label>
                  <input
                    type="email"
                    value={condominiums.find((c) => c.id === editingId)?.email || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">O email é visível ao gestor, mas a edição é feita pelo admin em Configurações.</p>
                </div>
              )}
              {editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Ativo
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

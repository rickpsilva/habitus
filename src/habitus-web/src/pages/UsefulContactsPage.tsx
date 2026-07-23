import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Plus, Edit2, Trash2, PhoneCall, ShieldAlert, Wrench, Building2 } from 'lucide-react';
import { usefulContactsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import SearchBar from '../components/SearchBar';
import type { UsefulContactCategory, UsefulContactDto } from '../types';

type CategoryOption = {
  value: number;
  label: string;
  icon: React.ElementType;
  badgeClass: string;
};

const categoryOptions: CategoryOption[] = [
  { value: 0, label: 'Emergencia', icon: ShieldAlert, badgeClass: 'bg-red-100 text-red-700' },
  { value: 1, label: 'Servico', icon: Wrench, badgeClass: 'bg-indigo-100 text-indigo-700' },
  { value: 2, label: 'Administrativo', icon: Building2, badgeClass: 'bg-slate-100 text-slate-700' },
];

const categoryByString: Record<string, number> = {
  Emergency: 0,
  Service: 1,
  Administrative: 2,
};

const initialForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  postalCode: '',
  locality: '',
  category: 0,
};

function normalizeCategory(category: UsefulContactCategory): number {
  if (typeof category === 'number') {
    return category;
  }

  return categoryByString[category] ?? 0;
}

function categoryMeta(category: UsefulContactCategory) {
  const value = normalizeCategory(category);
  return categoryOptions.find((option) => option.value === value) ?? categoryOptions[0];
}

export default function UsefulContactsPage() {
  const navigate = useNavigate();
  const { condominiumId, isAdmin, isManager } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [contacts, setContacts] = useState<UsefulContactDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<UsefulContactDto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (isManager) {
      navigate('/dashboard');
    }
  }, [isManager, navigate]);

  const loadContacts = useCallback(async () => {
    if (!condominiumId) {
      setContacts([]);
      setLoadError('Condomínio não identificado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const response = await usefulContactsApi.getAll(condominiumId);
      setContacts(response.data);
    } catch {
      setLoadError('Não foi possível carregar os contactos úteis.');
    } finally {
      setLoading(false);
    }
  }, [condominiumId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const category = categoryMeta(contact.category).label.toLowerCase();
      return (
        contact.name.toLowerCase().includes(query) ||
        contact.phone.toLowerCase().includes(query) ||
        category.includes(query)
      );
    });
  }, [contacts, searchQuery]);

  const openCreateModal = () => {
    setEditingContact(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditModal = (contact: UsefulContactDto) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      address: contact.address || '',
      postalCode: contact.postalCode || '',
      locality: contact.locality || '',
      category: normalizeCategory(contact.category),
    });
    setShowForm(true);
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingContact(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!condominiumId) {
      toastError('Condomínio não identificado.');
      return;
    }

    if (!form.name.trim() || !form.phone.trim()) {
      toastError('Nome e telefone sao obrigatorios.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        locality: form.locality.trim() || undefined,
        category: form.category,
      };

      if (editingContact) {
        await usefulContactsApi.update(condominiumId, editingContact.id, payload);
        toastSuccess('Contacto util atualizado com sucesso.');
      } else {
        await usefulContactsApi.create(condominiumId, payload);
        toastSuccess('Contacto util criado com sucesso.');
      }

      closeModal();
      await loadContacts();
    } catch {
      toastError('Não foi possível guardar o contacto útil.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || !condominiumId) {
      setDeleteId(null);
      return;
    }

    try {
      await usefulContactsApi.delete(condominiumId, deleteId);
      toastSuccess('Contacto util eliminado com sucesso.');
      await loadContacts();
    } catch {
      toastError('Não foi possível eliminar o contacto útil.');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={deleteId !== null}
        title="Eliminar contacto util"
        message="Tem a certeza que deseja eliminar este contacto? Esta ação não pode ser revertida."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ModalPopup
        open={showForm}
        onClose={closeModal}
        title={editingContact ? 'Editar Contacto Util' : 'Novo Contacto Util'}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: Bombeiros de Lisboa"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: +351 213 000 000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: contacto@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Morada</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: Rua Principal, 123"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ex: 1000-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localidade</label>
              <input
                type="text"
                value={form.locality}
                onChange={(e) => setForm((prev) => ({ ...prev, locality: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ex: Lisboa"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'A guardar...' : editingContact ? 'Guardar' : 'Criar'}
            </button>
          </div>
        </form>
      </ModalPopup>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Phone className="w-7 h-7 text-indigo-600" />
            Contactos Úteis
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Lista de contactos importantes do condomínio.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Contacto
          </button>
        )}
      </div>

      <div className="max-w-md">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Pesquisar por nome, telefone ou categoria..."
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-500">A carregar contactos...</div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{loadError}</div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <PhoneCall className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sem contactos úteis registados</p>
          <p className="text-gray-400 text-sm mt-1">
            {isAdmin ? 'Adicione o primeiro contacto para o condomínio.' : 'Ainda não existem contactos disponíveis.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => {
            const meta = categoryMeta(contact.category);
            const Icon = meta.icon;

            return (
              <div
                key={contact.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{contact.name}</h3>
                    <a href={`tel:${contact.phone}`} className="text-sm text-indigo-600 hover:text-indigo-700">
                      {contact.phone}
                    </a>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(contact)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(contact.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  {contact.email && (
                    <div className="text-gray-600">
                      <a href={`mailto:${contact.email}`} className="text-indigo-600 hover:text-indigo-700">
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.address && (
                    <div className="text-gray-600">{contact.address}</div>
                  )}
                  {(contact.postalCode || contact.locality) && (
                    <div className="text-gray-600">
                      {contact.postalCode && <span>{contact.postalCode}</span>}
                      {contact.postalCode && contact.locality && <span>, </span>}
                      {contact.locality && <span>{contact.locality}</span>}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${meta.badgeClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
